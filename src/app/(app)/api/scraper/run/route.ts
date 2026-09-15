import type { ScraperJob } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { checkRole } from '@/access/utilities'
import { detectLanguage } from '@/scraper/language'
import { discover, type DiscoverResult } from '@/scraper/discover'
import { importProduct, toPreview } from '@/scraper/importProduct'
import { tryFetchPage } from '@/scraper/fetchPage'
import { scrapeAndPrepare } from '@/scraper/pipeline'
import type { ProductPreview } from '@/scraper/types'

/**
 * POST /api/scraper/run — jeden krok importu z cudzieho e-shopu (Z12).
 *
 * Telo: `{ jobId: number|string, mode: 'preview' | 'batch' }`.
 *
 * `preview`  — nájde produkty (ak fronta ešte nie je naplnená), prvé tri
 *              stiahne, preloží a prepočíta, uloží ich do `previews` a prepne
 *              úlohu na „čaká na potvrdenie“. NIČ sa neimportuje.
 * `batch`    — spracuje ďalších `batchSize` produktov z fronty: stiahne,
 *              preloží, prepočíta cenu a založí produkt. Posunie kurzor,
 *              dopočíta počítadlá a keď je fronta na konci, prepne na „hotovo“.
 *
 * **Jedno volanie = jedna dávka.** Opakovanie riadi prehliadač
 * (`ScraperJobControls`), nie server: `maxDuration` je 60 s a import stoviek
 * produktov trvá desiatky minút. Keby sa slučka točila tu, funkcia by sa
 * odstrelila uprostred dávky a úloha by ostala v nekonzistentnom stave.
 *
 * Zdvorilosť k cudziemu serveru (≥ 1 s medzi požiadavkami) je zabudovaná v
 * `pipeline`/`discover`/`importProduct`, takže platí bez ohľadu na to, kto
 * ich volá. Preto je aj `batchSize` zhora obmedzená na 10 — pri sekunde na
 * stránku plus sťahovanie fotiek je to strop, ktorý sa do 60 s ešte zmestí.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RunBody = {
  jobId?: unknown
  mode?: unknown
}

/** Koľko produktov ide do testovacieho behu. */
const PREVIEW_SIZE = 3

/**
 * Koľko z 60 s routy smie zjesť prehľadávanie zdroja.
 *
 * Zvyšok potrebuje sťahovanie a preklad produktov (a pri dávke aj sťahovanie
 * fotiek), takže prehľadávanie sa po tomto čase zastaví a neprejdené kategórie
 * odloží do `productLinks` — ďalšie volanie v nich pokračuje.
 */
const DISCOVERY_BUDGET_MS = 22_000

/**
 * Po tomto čase sa v dávke už nezačne ďalší produkt.
 *
 * `maxDuration` je 60 s; 48 s necháva rezervu na dokončenie rozbehnutého
 * produktu (sťahovanie poslednej fotky + zápis) a na uloženie úlohy.
 */
const IMPORT_DEADLINE_MS = 48_000

/**
 * Hrubý odhad času na jeden produkt: stránka + preklad + až osem fotiek,
 * každá s povinnou sekundovou pauzou. Slúži len na zmenšenie dávky, keď
 * prehľadávanie zjedlo väčšinu volania — presnosť netreba, poistkou je
 * `IMPORT_DEADLINE_MS`.
 */
const ESTIMATED_MS_PER_PRODUCT = 9_000

/** Strop na dĺžku logu — inak by dokument rástol do megabajtov. */
const MAX_LOG_CHARS = 20_000

const now = (): string =>
  new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Nové riadky idú navrch, aby bolo v admine hneď vidieť, čo sa deje teraz. */
const appendLog = (existing: null | string | undefined, lines: string[]): string => {
  const stamped = lines.map((line) => `[${now()}] ${line}`)

  return [...stamped, existing ?? ''].join('\n').trim().slice(0, MAX_LOG_CHARS)
}

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })

  // Scraper siaha von na cudzie servery a míňa AI kredit — žiadny iný než
  // administrátorský účet ho nesmie spustiť.
  if (!checkRole(['admin'], user)) {
    return json({ message: 'Prístup zamietnutý.', ok: false }, 403)
  }

  let body: RunBody = {}

  try {
    body = (await request.json()) as RunBody
  } catch {
    return json({ message: 'Neplatná požiadavka.', ok: false }, 400)
  }

  const jobId = typeof body.jobId === 'number' || typeof body.jobId === 'string' ? body.jobId : null
  const mode = body.mode === 'batch' ? 'batch' : body.mode === 'preview' ? 'preview' : null

  if (jobId === null || mode === null) {
    return json({ message: 'Chýba jobId alebo mode.', ok: false }, 400)
  }

  let job: ScraperJob

  try {
    job = (await payload.findByID({
      collection: 'scraper-jobs',
      id: jobId,
      depth: 0,
      overrideAccess: true,
    })) as ScraperJob
  } catch {
    return json({ message: 'Úloha sa nenašla.', ok: false }, 404)
  }

  const sourceUrl = job.sourceUrl?.trim()

  if (!sourceUrl) {
    return json({ message: 'Úloha nemá zadanú adresu obchodu.', ok: false }, 400)
  }

  const counters = {
    discovered: job.counters?.discovered ?? 0,
    failed: job.counters?.failed ?? 0,
    imported: job.counters?.imported ?? 0,
    skipped: job.counters?.skipped ?? 0,
  }

  const maxProducts = Math.max(1, job.maxProducts ?? 500)
  const batchSize = Math.min(10, Math.max(1, job.batchSize ?? 5))
  const fallbackRate = job.fallbackRate ?? 4.3

  const logLines: string[] = []
  const startedAt = Date.now()

  /**
   * Stav prehľadávania (fronta adries + ešte neprejdené kategórie).
   *
   * Historicky sa do `productLinks` ukladalo holé pole adries; taký dokument
   * sa načíta aj teraz a len sa doplní o „prehľadané do konca".
   */
  let state: DiscoverResult = Array.isArray(job.productLinks)
    ? {
        categories: [],
        complete: true,
        productUrls: job.productLinks as string[],
        strategy: 'shoper',
      }
    : ((job.productLinks as null | DiscoverResult) ?? {
        categories: [],
        complete: false,
        productUrls: [],
        strategy: 'shoper',
      })

  let detectedLanguage = job.detectedLanguage ?? null

  try {
    // --- naplnenie fronty + rozpoznanie jazyka ----------------------------
    //
    // Prehľadávanie sa musí zmestiť do 60 s routy AJ so sekundovou pauzou medzi
    // požiadavkami, takže dostáva iba časť času a pri jeho vyčerpaní odloží
    // zvyšné kategórie do `state.categories`. Testovací beh tak vie ukázať
    // náhľady hneď z prvých nájdených produktov a zvyšok katalógu sa dohľadá
    // počas dávok — to je aj dôvod, prečo je `discovered` priebežne rastúce
    // číslo a nie konečný súčet hneď na začiatku.
    if (!state.productUrls.length || !state.complete) {
      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: { status: mode === 'preview' ? 'preview_running' : 'importing' },
        overrideAccess: true,
      })

      if (!detectedLanguage) {
        const entry = await tryFetchPage(sourceUrl)

        if (entry) detectedLanguage = await detectLanguage(entry.html)

        logLines.push(`Jazyk zdroja: ${detectedLanguage ?? 'neurčený'}`)
      }

      const before = state.productUrls.length

      state = await discover(sourceUrl, {
        deadlineAt: startedAt + DISCOVERY_BUDGET_MS,
        known: state.productUrls.length || state.categories.length ? state : null,
        maxProducts,
        onProgress: (message) => logLines.push(message),
      })

      counters.discovered = state.productUrls.length

      logLines.push(
        `Nájdených ${state.productUrls.length} produktov (+${
          state.productUrls.length - before
        }, stratégia: ${state.strategy})${
          state.complete
            ? '.'
            : `; ostáva prejsť ${state.categories.length} kategórií — dohľadá sa počas ďalších dávok.`
        }`,
      )
    }

    const queue = state.productUrls

    if (!queue.length) {
      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          counters,
          detectedLanguage,
          log: appendLog(job.log, [...logLines, 'Na zadanej adrese sa nenašiel žiadny produkt.']),
          status: 'failed',
        },
        overrideAccess: true,
      })

      return json({ message: 'Na zadanej adrese sa nenašiel žiadny produkt.', ok: false }, 200)
    }

    // --- testovací beh ----------------------------------------------------
    if (mode === 'preview') {
      const sample = queue.slice(0, PREVIEW_SIZE)
      const result = await scrapeAndPrepare(sample, {
        fallbackRate,
        fromLang: detectedLanguage,
        onProgress: (message) => logLines.push(message),
      })

      const previews: ProductPreview[] = result.items.map((item) =>
        toPreview(item.scraped, item.translated, item.priceInEUR),
      )

      for (const failure of result.failures) {
        logLines.push(`Nepodarilo sa načítať ${failure.url}: ${failure.message}`)
      }

      logLines.push(
        `Testovací beh: ${previews.length} náhľadov, kurz ${result.rate?.toFixed(4) ?? '—'} (${
          result.rateSource === 'live' ? 'živý' : result.rateSource === 'eur' ? 'bez prepočtu' : 'záložný'
        }), preklad ${result.usage.calls}× (${result.usage.inputTokens} + ${result.usage.outputTokens} tokenov).`,
        ...result.usage.failures,
      )

      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          counters,
          cursor: 0,
          detectedLanguage,
          log: appendLog(job.log, logLines),
          previews,
          productLinks: state,
          status: previews.length ? 'awaiting_confirm' : 'failed',
        },
        overrideAccess: true,
      })

      return json({ counters, ok: true, previews, status: previews.length ? 'awaiting_confirm' : 'failed' })
    }

    // --- dávkový import ---------------------------------------------------
    const cursor = Math.max(0, job.cursor ?? 0)
    // Keď prehľadávanie zjedlo čas, dávka sa na tento krok zmenší — inak by ju
    // 60 s limit odstrelil uprostred a kurzor by sa neposunul vôbec.
    const roomForBatch = Math.max(
      1,
      Math.round((IMPORT_DEADLINE_MS - (Date.now() - startedAt)) / ESTIMATED_MS_PER_PRODUCT),
    )
    const slice = queue.slice(cursor, cursor + Math.min(batchSize, roomForBatch))

    if (!slice.length) {
      // Prázdna fronta ešte nemusí znamenať koniec: keď sa zoznam produktov
      // stále dopĺňa (veľký katalóg, prerušené prehľadávanie), ďalšie volanie
      // najprv dohľadá ďalšie kategórie a až potom sa importuje.
      const finished = state.complete

      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          counters,
          detectedLanguage,
          log: appendLog(job.log, [
            ...logLines,
            finished
              ? 'Fronta je prázdna — import je hotový.'
              : 'Fronta je dočasne prázdna, pokračuje sa v prehľadávaní zdroja.',
          ]),
          productLinks: state,
          status: finished ? 'done' : 'importing',
        },
        overrideAccess: true,
      })

      return json({
        counters,
        done: finished,
        ok: true,
        processed: 0,
        status: finished ? 'done' : 'importing',
        total: queue.length,
      })
    }

    const result = await scrapeAndPrepare(slice, {
      fallbackRate,
      fromLang: detectedLanguage,
      onProgress: (message) => logLines.push(message),
    })

    logLines.push(...result.usage.failures)

    /**
     * Čo sa v tejto dávke naozaj vybavilo — kľúčom je zdrojová adresa.
     *
     * Kurzor sa potom posunie len o SÚVISLÝ ÚSEK vybavených adries od jeho
     * aktuálnej pozície. Preskočiť produkt je totiž neopraviteľná chyba
     * (nikto sa k nemu už nevráti), kým zopakovať ho nestojí nič — import je
     * idempotentný a druhýkrát ho len preskočí.
     */
    const handled = new Set<string>()

    for (const failure of result.failures) {
      handled.add(failure.url)
      logLines.push(`Nepodarilo sa načítať ${failure.url}: ${failure.message}`)
    }

    // Sťahovanie fotiek (sekunda na fotku, až osem na produkt) je tá časť
    // dávky, ktorá sa najľahšie natiahne cez limit volania — preto sa pred
    // každým ďalším produktom pozerá na hodiny.
    for (const [index, item] of result.items.entries()) {
      if (index > 0 && Date.now() - startedAt > IMPORT_DEADLINE_MS) {
        logLines.push(
          `Zvyšok dávky (${result.items.length - index}) sa odkladá do ďalšieho kroku — dochádza čas volania.`,
        )
        break
      }

      const outcome = await importProduct(payload, item)

      if (outcome.status === 'created') counters.imported++
      else if (outcome.status === 'skipped') counters.skipped++
      else counters.failed++

      handled.add(item.scraped.sourceUrl)
      logLines.push(outcome.message)
    }

    let processed = 0

    while (processed < slice.length && handled.has(slice[processed]!)) processed++

    // Neúspešné sťahovania sa započítajú len v rámci prejdeného úseku — inak
    // by sa tá istá chyba pripočítala znova, keď sa zvyšok dávky zopakuje.
    counters.failed += result.failures.filter((failure) =>
      slice.slice(0, processed).includes(failure.url),
    ).length

    const nextCursor = cursor + processed
    // Hotovo je to až vtedy, keď je prejdená fronta AJ dohľadané kategórie —
    // inak by sa import vyhlásil za dokončený uprostred katalógu.
    const done = nextCursor >= queue.length && state.complete

    logLines.push(
      `Dávka ${cursor + 1}–${nextCursor} z ${queue.length}${
        state.complete ? '' : ' (zoznam sa ešte dopĺňa)'
      }${done ? ' — hotovo.' : '.'}`,
    )

    await payload.update({
      collection: 'scraper-jobs',
      id: jobId,
      data: {
        counters,
        cursor: nextCursor,
        detectedLanguage,
        log: appendLog(job.log, logLines),
        productLinks: state,
        status: done ? 'done' : 'importing',
      },
      overrideAccess: true,
    })

    return json({
      counters,
      done,
      ok: true,
      processed,
      remaining: Math.max(0, queue.length - nextCursor),
      status: done ? 'done' : 'importing',
      total: queue.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error(`[scraper] Úloha ${String(jobId)} zlyhala: ${message}`)

    await payload
      .update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          counters,
          detectedLanguage,
          log: appendLog(job.log, [...logLines, `CHYBA: ${message}`]),
          status: 'failed',
        },
        overrideAccess: true,
      })
      .catch(() => undefined)

    return json({ message, ok: false }, 500)
  }
}
