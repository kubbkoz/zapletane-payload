/**
 * Spojenie krokov scrapera do jednej reťaze (Z12).
 *
 * `scrapeAndPrepare` je to, čo volajú OBE vetvy API routy — testovací beh aj
 * dávkový import. Vďaka tomu vidí majiteľka v náhľade presne ten istý výsledok
 * (rovnaký názov, rovnaký preklad, rovnaká cena), aký sa potom uloží; keby si
 * náhľad robil vlastnú, „odľahčenú" verziu, bol by to náhľad niečoho iného.
 *
 * Zdvorilosť je zabudovaná sem, nie do `fetchPage`: medzi dvomi stránkami
 * cudzieho e-shopu je vždy pauza, ale na náš vlastný Payload (zápisy) sa
 * nečaká.
 */
import type { PreparedProduct, ScrapedProduct } from './types'

import { extractProduct } from './extract'
import { fetchPage, politeDelay, POLITE_DELAY_MS } from './fetchPage'
import { convertPrice } from './price'
import { normalizeTitle, properNounHints } from './titleCase'
import { translateBatch, type TranslationUsage } from './translate'

export type ScrapeOptions = {
  fallbackRate?: null | number
  fromLang?: null | string
  onProgress?: (message: string) => void
  politeDelayMs?: number
  /** Vypne živý kurz (testy, opakované dávky). */
  skipLiveRate?: boolean
}

export type ScrapeResult = {
  /** Adresy, ktoré sa stiahnuť nepodarili — v úlohe sa počítajú ako chyby. */
  failures: Array<{ message: string; url: string }>
  items: PreparedProduct[]
  /** Kurz použitý pri poslednom prepočte — do logu úlohy. */
  rate: null | number
  rateSource: null | string
  usage: TranslationUsage
}

/**
 * Stiahne, vyextrahuje, preloží a prepočíta ceny pre zoznam adries.
 *
 * Preklad ide *hromadne* po stiahnutí všetkých stránok, nie po jednej: jedno
 * volanie modelu na šesť produktov je lacnejšie aj rýchlejšie než šesť volaní,
 * a keďže dávka má aj tak strop (`batchSize` ≤ 10), zmestí sa do jedného až
 * dvoch volaní.
 */
export const scrapeAndPrepare = async (
  urls: string[],
  options: ScrapeOptions = {},
): Promise<ScrapeResult> => {
  const delay = options.politeDelayMs ?? POLITE_DELAY_MS
  const scraped: ScrapedProduct[] = []
  const failures: ScrapeResult['failures'] = []

  for (const [index, url] of urls.entries()) {
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
        failures.push({ message: 'Na stránke sa nenašiel názov produktu.', url })
        continue
      }

      scraped.push(product)
      options.onProgress?.(
        `Načítané: ${product.title} (${product.images.length} fotiek, ${
          product.priceAmount ?? '?'
        } ${product.priceCurrency ?? ''})`,
      )
    } catch (error) {
      failures.push({ message: error instanceof Error ? error.message : String(error), url })
    }
  }

  const { items: translated, usage } = await translateBatch(scraped, options.fromLang ?? null)

  const items: PreparedProduct[] = []
  let rate: null | number = null
  let rateSource: null | string = null

  for (const [index, product] of scraped.entries()) {
    const conversion = await convertPrice(product.priceAmount, product.priceCurrency, {
      fallbackRate: options.fallbackRate,
      skipLiveRate: options.skipLiveRate,
    })

    if (conversion) {
      rate = conversion.rate
      rateSource = conversion.source
    }

    const base = translated[index] ?? {
      attributes: product.attributes,
      categoryPath: product.categoryPath,
      descriptionParagraphs: [],
      title: product.title,
    }

    /**
     * Druhá vrstva opravy KRIČANÝCH názvov (Z14).
     *
     * Prvou je prompt prekladača, ktorý má vracať prirodzenú vetnú podobu.
     * Táto vrstva beží aj tak — keď preklad zlyhal, keď je zdroj už po
     * slovensky, aj keď model pravidlo prehliadol. Nápovedy na vlastné mená
     * sa zbierajú z textov, ktoré kapitálkami písané nie sú (popis produktu),
     * takže „REGAN" prežije ako „Regan" a nie ako „regan".
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

  return { failures, items, rate, rateSource, usage }
}
