/**
 * Spojenie krokov scrapera do jednej reťaze (Z12, opravené Z16).
 *
 * `scrapeAndPrepare` je to, čo volajú OBE vetvy API routy — testovací beh aj
 * dávkový import. Vďaka tomu vidí majiteľka v náhľade presne ten istý výsledok
 * (rovnaký názov, rovnaký preklad, rovnaká cena), aký sa potom uloží; keby si
 * náhľad robil vlastnú, „odľahčenú" verziu, bol by to náhľad niečoho iného.
 *
 * Zdvorilosť je zabudovaná sem, nie do `fetchPage`: medzi dvomi stránkami
 * cudzieho e-shopu je vždy pauza, ale na náš vlastný Payload (zápisy) sa
 * nečaká.
 *
 * **Z16 — tri stavy namiesto dvoch.** Predtým bol výsledok buď produkt, alebo
 * chyba sťahovania; nepreložený produkt vyzeral ako preložený a ticho sa
 * importoval v pôvodnom jazyku. Teraz sa vracajú tri zoznamy:
 *
 *   - `items` — pripravené produkty. Text je zaručene slovenský (alebo bol
 *     slovenský už v zdroji). Nič iné sa sem nedostane.
 *   - `failures` — adresy, kde zlyhalo sťahovanie alebo preklad. Volajúci ich
 *     ráta ako pokusy a po treťom sa produktu vzdáva.
 *   - `deferred` — adresy, na ktoré v rozpočte tohto volania nezvýšil čas.
 *     NIE JE to chyba: ostávajú vo fronte pre ďalší článok reťaze.
 *
 * **Jeden rozpočet, nie dva časovače.** `deadlineAt` (epoch ms) je jediná
 * pravda o tom, dokedy sa smie pracovať. Z neho si `translateBatch` odvodí
 * strop na volanie modelu a podľa neho sa aj prestane sťahovať. Druhý,
 * nezávislý časovač v prekladači by s týmto rozpočtom len súperil.
 */
import type { PreparedProduct, ScrapedProduct } from './types'

import { extractProduct } from './extract'
import { fetchPage, politeDelay, POLITE_DELAY_MS } from './fetchPage'
import { convertPrice } from './price'
import { normalizeTitle, properNounHints } from './titleCase'
import {
  translateBatch,
  TRANSLATION_MIN_TIMEOUT_MS,
  type TranslationFailureCause,
  type TranslationUsage,
} from './translate'

/**
 * Hrubý odhad na stiahnutie jednej stránky produktu (pauza + požiadavka).
 *
 * Slúži len na to, aby sa nezačalo sťahovanie, po ktorom by už nebolo z čoho
 * prekladať. Presnosť netreba — poistkou je `deadlineAt`.
 */
const SCRAPE_STEP_MS = 4_000

export type ScrapeOptions = {
  /** Koľko produktov ide do jedného prekladového volania. */
  chunkSize?: number
  /** Dokedy smie práca trvať (epoch ms). `null` = bez rozpočtu (testy). */
  deadlineAt?: null | number
  fallbackRate?: null | number
  fromLang?: null | string
  onProgress?: (message: string) => void
  politeDelayMs?: number
  /** Koľko času si volajúci necháva po preklade na zápis produktov. */
  reserveMs?: number
  /** Vypne živý kurz (testy, opakované dávky). */
  skipLiveRate?: boolean
}

/** Prečo sa z adresy nestal produkt. `fetch` = nestiahlo sa, zvyšok = preklad. */
export type PreparedFailure = {
  cause: 'fetch' | TranslationFailureCause
  message: string
  url: string
}

export type ScrapeResult = {
  /** Adresy odložené pre nedostatok času — ostávajú vo fronte, nie sú to chyby. */
  deferred: string[]
  /** Adresy, ktoré sa nepodarilo stiahnuť ANI preložiť — v úlohe sú to chyby. */
  failures: PreparedFailure[]
  items: PreparedProduct[]
  /** Kurz použitý pri poslednom prepočte — do logu úlohy. */
  rate: null | number
  rateSource: null | string
  usage: TranslationUsage
}

/**
 * Stiahne, vyextrahuje, preloží a prepočíta ceny pre zoznam adries.
 *
 * Preklad ide *hromadne* po stiahnutí stránok, nie po jednej: jedno volanie
 * modelu na dvojicu produktov je lacnejšie aj rýchlejšie než dve volania.
 * Volajúci túto funkciu púšťa po malých skupinkách (`TRANSLATION_CHUNK_SIZE`),
 * aby sa medzi prekladom a zápisom do databázy striedalo a rozpočet sa dal
 * priebežne kontrolovať.
 */
export const scrapeAndPrepare = async (
  urls: string[],
  options: ScrapeOptions = {},
): Promise<ScrapeResult> => {
  const delay = options.politeDelayMs ?? POLITE_DELAY_MS
  const reserveMs = options.reserveMs ?? 0
  const scraped: ScrapedProduct[] = []
  const failures: ScrapeResult['failures'] = []
  const deferred: string[] = []

  for (const [index, url] of urls.entries()) {
    // Sťahovať stránku, na ktorej preklad už nezostane čas, nemá zmysel —
    // zaťažuje cudzí server a produkt aj tak skončí ako odložený.
    if (
      options.deadlineAt &&
      options.deadlineAt - Date.now() - reserveMs < TRANSLATION_MIN_TIMEOUT_MS + SCRAPE_STEP_MS
    ) {
      deferred.push(...urls.slice(index))
      break
    }

    if (index > 0) await politeDelay(delay)

    try {
      const page = await fetchPage(url)
      // Na rozbalenie relatívnych odkazov sa použije adresa PO presmerovaní
      // (inak by sa obrázky poskladali voči nesprávnej ceste), ale `sourceUrl`
      // sa vráti späť na tú, ktorá bola vo fronte. Je to kľúč idempotencie aj
      // to, podľa čoho si route páruje výsledky s dávkou — a keby sa líšil od
      // fronty, produkt by sa importoval znova a znova.
      const product = { ...extractProduct(page.finalUrl || url, page.html), sourceUrl: url }

      if (!product.title.trim()) {
        failures.push({ cause: 'fetch', message: 'Na stránke sa nenašiel názov produktu.', url })
        continue
      }

      scraped.push(product)
      options.onProgress?.(
        `Načítané: ${product.title} (${product.images.length} fotiek, ${
          product.priceAmount ?? '?'
        } ${product.priceCurrency ?? ''})`,
      )
    } catch (error) {
      failures.push({
        cause: 'fetch',
        message: error instanceof Error ? error.message : String(error),
        url,
      })
    }
  }

  const { outcomes, usage } = await translateBatch(scraped, options.fromLang ?? null, {
    chunkSize: options.chunkSize,
    deadlineAt: options.deadlineAt,
    reserveMs,
  })

  const items: PreparedProduct[] = []
  let rate: null | number = null
  let rateSource: null | string = null

  for (const [index, product] of scraped.entries()) {
    const outcome = outcomes[index]

    // Nepreložený produkt sa NEIMPORTUJE. Toto je tá vetva, ktorá do Z16
    // vracala poľský originál a majiteľka ho našla v obchode.
    if (!outcome || outcome.kind !== 'ok') {
      if (outcome?.kind === 'deferred') deferred.push(product.sourceUrl)
      else {
        failures.push({
          cause: outcome?.cause ?? 'json',
          message: outcome?.reason ?? 'Preklad nevrátil výsledok.',
          url: product.sourceUrl,
        })
      }

      continue
    }

    const base = outcome.product

    const conversion = await convertPrice(product.priceAmount, product.priceCurrency, {
      fallbackRate: options.fallbackRate,
      skipLiveRate: options.skipLiveRate,
    })

    if (conversion) {
      rate = conversion.rate
      rateSource = conversion.source
    }

    /**
     * Druhá vrstva opravy KRIČANÝCH názvov (Z14).
     *
     * Prvou je prompt prekladača, ktorý má vracať prirodzenú vetnú podobu.
     * Táto vrstva beží aj tak — keď je zdroj už po slovensky, aj keď model
     * pravidlo prehliadol. Nápovedy na vlastné mená sa zbierajú z textov, ktoré
     * kapitálkami písané nie sú (popis produktu), takže „REGAN" prežije ako
     * „Regan" a nie ako „regan".
     */
    const hints = properNounHints([
      ...base.descriptionParagraphs,
      product.descriptionText,
      ...base.categoryPath,
    ])

    items.push({
      priceInEUR: conversion?.eurocents ?? null,
      scraped: product,
      translated: { ...base, title: normalizeTitle(base.title, hints) || base.title },
    })
  }

  return { deferred, failures, items, rate, rateSource, usage }
}
