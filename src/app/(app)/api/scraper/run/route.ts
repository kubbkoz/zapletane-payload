import type { ScraperJob } from '@/payload-types'

import configPromise from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { checkRole } from '@/access/utilities'
import {
  CHAIN_LIMIT,
  hasInternalToken,
  internalToken,
  isHeartbeatStale,
  kickBatch,
  runEndpointFrom,
} from '@/scraper/chain'
import { detectLanguage } from '@/scraper/language'
import {
  discover,
  discoverCategories,
  strategyForCategories,
  type DiscoverResult,
} from '@/scraper/discover'
import { importProduct, toPreview } from '@/scraper/importProduct'
import { tryFetchPage } from '@/scraper/fetchPage'
import { scrapeAndPrepare } from '@/scraper/pipeline'
import { translateCategoryNames } from '@/scraper/translate'
import type { CategoryMapEntry, ProductPreview } from '@/scraper/types'

/**
 * POST /api/scraper/run — jeden krok importu z cudzieho e-shopu (Z12, Z14).
 *
 * Telo: `{ jobId, mode: 'categories' | 'preview' | 'batch' | 'stop',
 *          chain?: boolean, expectCursor?: number }`.
 *
 * `categories` — jednou požiadavkou vytiahne z navigácie zdroja zoznam
 *                kategórií, jedným volaním modelu preloží ich názvy a uloží
 *                ich do `categoryMap`. Nič nesťahuje a nič neimportuje.
 * `preview`    — nájde produkty (ak fronta ešte nie je naplnená), prvé tri
 *                stiahne, preloží a prepočíta, uloží ich do `previews` a
 *                prepne úlohu na „čaká na potvrdenie". NIČ sa neimportuje.
 * `batch`      — spracuje ďalších `batchSize` produktov z fronty a keď fronta
 *                nie je na konci, zavolá si cez `after()` ďalšiu dávku.
 * `stop`       — prepne stav na „zastavené"; bežiaca reťaz sa na začiatku
 *                nasledujúcej dávky vzdá.
 *
 * **Jedno volanie = jedna dávka.** To sa nezmenilo: `maxDuration` je 60 s a
 * import stoviek produktov trvá desiatky minút. Zmenilo sa, KTO volá ďalšiu —
 * do Z13 prehliadač, od Z14 server sám (`src/scraper/chain.ts`). Prehliadač
 * teraz len raz kopne a potom sa pozerá na počítadlá, takže zavretá karta
 * import nezastaví.
 *
 * **Autorizácia.** Buď prihlásená administrátorka, alebo hlavička
 * `Authorization: Bearer <SCRAPER_INTERNAL_TOKEN>` — tú používa reťaz a denný
 * záchranný beh `/api/scraper/tick`, kde žiadna relácia neexistuje.
 *
 * Zdvorilosť k cudziemu serveru (≥ 1 s medzi požiadavkami) je zabudovaná v
 * `pipeline`/`discover`/`importProduct`, takže platí bez ohľadu na to, kto
 * ich volá. Preto je aj `batchSize` zhora obmedzená na 10 — pri sekunde na
 * stránku plus sťahovanie fotiek je to strop, ktorý sa do 60 s ešte zmestí.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RunBody = {
  chain?: unknown
  expectCursor?: unknown
  jobId?: unknown
  mode?: unknown
}

type Mode = 'batch' | 'categories' | 'preview' | 'stop'

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

/** `categoryMap` z dokumentu → typované položky (pole je `json`, teda `unknown`). */
const readCategoryMap = (value: unknown): CategoryMapEntry[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => ({
          name: String(entry.name ?? ''),
          productCountEstimate:
            typeof entry.productCountEstimate === 'number' ? entry.productCountEstimate : null,
          selected: entry.selected === true,
          translatedName: String(entry.translatedName ?? entry.name ?? ''),
          url: String(entry.url ?? ''),
        }))
        .filter((entry) => entry.url)
    : []

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const internal = hasInternalToken(request.headers)
  const { user } = internal ? { user: null } : await payload.auth({ headers: request.headers })

  // Scraper siaha von na cudzie servery a míňa AI kredit — pustí ho buď
  // administrátorský účet, alebo reťaz s interným tokenom. Nikto iný.
  if (!internal && !checkRole(['admin'], user)) {
    return json({ message: 'Prístup zamietnutý.', ok: false }, 403)
  }

  let body: RunBody = {}

  try {
    body = (await request.json()) as RunBody
  } catch {
    return json({ message: 'Neplatná požiadavka.', ok: false }, 400)
  }

  const jobId = typeof body.jobId === 'number' || typeof body.jobId === 'string' ? body.jobId : null
  const mode: Mode | null =
    body.mode === 'batch'
      ? 'batch'
      : body.mode === 'preview'
        ? 'preview'
        : body.mode === 'categories'
          ? 'categories'
          : body.mode === 'stop'
            ? 'stop'
            : null

  // Reťazové volanie smie prísť len s interným tokenom — inak by si ktokoľvek
  // s administrátorskou reláciou mohol omylom rozbehnúť druhú reťaz.
  const isChainCall = body.chain === true && internal
  const expectCursor = typeof body.expectCursor === 'number' ? body.expectCursor : null

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

  // --- zastavenie -----------------------------------------------------------
  if (mode === 'stop') {
    await payload.update({
      collection: 'scraper-jobs',
      id: jobId,
      data: {
        log: appendLog(job.log, ['Import zastavený — pokračovať sa dá kedykoľvek.']),
        status: 'stopped',
      },
      overrideAccess: true,
    })

    return json({ ok: true, status: 'stopped' })
  }

  const counters = {
    discovered: job.counters?.discovered ?? 0,
    failed: job.counters?.failed ?? 0,
    imported: job.counters?.imported ?? 0,
    skipped: job.counters?.skipped ?? 0,
    skippedExisting: job.counters?.skippedExisting ?? 0,
  }

  const maxProducts = Math.max(1, job.maxProducts ?? 500)
  const batchSize = Math.min(10, Math.max(1, job.batchSize ?? 5))
  const fallbackRate = job.fallbackRate ?? 4.3

  const logLines: string[] = []
  const startedAt = Date.now()
  const categoryMap = readCategoryMap(job.categoryMap)

  let detectedLanguage = job.detectedLanguage ?? null

  // --- zoznam kategórií (Z14) -----------------------------------------------
  if (mode === 'categories') {
    try {
      const { categories, html } = await discoverCategories(sourceUrl, {
        onProgress: (message) => logLines.push(message),
      })

      if (!detectedLanguage) {
        detectedLanguage = await detectLanguage(html)
        logLines.push(`Jazyk zdroja: ${detectedLanguage ?? 'neurčený'}`)
      }

      if (!categories.length) {
        await payload.update({
          collection: 'scraper-jobs',
          id: jobId,
          data: {
            detectedLanguage,
            log: appendLog(job.log, [
              ...logLines,
              'Na zadanej adrese sa nenašli žiadne kategórie — import pôjde cez celý obchod.',
            ]),
          },
          overrideAccess: true,
        })

        return json({ categories: [], ok: true, status: job.status })
      }

      const translation = await translateCategoryNames(
        categories.map((category) => category.name),
        detectedLanguage,
      )

      if (translation.failure) logLines.push(translation.failure)

      // Výber, ktorý už majiteľka spravila, sa pri opätovnom načítaní
      // NESMIE stratiť — spáruje sa podľa adresy.
      const previous = new Map(categoryMap.map((entry) => [entry.url, entry.selected]))

      const nextMap: CategoryMapEntry[] = categories.map((category, index) => ({
        name: category.name,
        productCountEstimate: category.productCountEstimate,
        selected: previous.get(category.url) ?? false,
        translatedName: translation.names[index] || category.name,
        url: category.url,
      }))

      logLines.push(
        `Načítaných ${nextMap.length} kategórií${translation.failure ? '' : ', názvy preložené'}.`,
      )

      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          categoryMap: nextMap,
          detectedLanguage,
          log: appendLog(job.log, logLines),
          status: 'categories_ready',
        },
        overrideAccess: true,
      })

      return json({ categories: nextMap, ok: true, status: 'categories_ready' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await payload
        .update({
          collection: 'scraper-jobs',
          id: jobId,
          data: { log: appendLog(job.log, [...logLines, `CHYBA: ${message}`]) },
          overrideAccess: true,
        })
        .catch(() => undefined)

      return json({ message, ok: false }, 500)
    }
  }

  // --- brzdy reťaze ---------------------------------------------------------
  //
  // Všetky sa vyhodnocujú PRED akoukoľvek prácou, aby zastavená či zdvojená
  // reťaz nestihla siahnuť von na cudzí server ani na model.
  if (mode === 'batch') {
    if (isChainCall) {
      if (job.status !== 'importing') {
        return json({ halted: 'status', ok: true, status: job.status })
      }

      if (expectCursor !== null && (job.cursor ?? 0) !== expectCursor) {
        return json({ halted: 'cursor', ok: true, status: job.status })
      }

      if ((job.chainCount ?? 0) >= CHAIN_LIMIT) {
        await payload.update({
          collection: 'scraper-jobs',
          id: jobId,
          data: {
            log: appendLog(job.log, [
              `Dosiahnutý strop ${CHAIN_LIMIT} zreťazených dávok — import je zastavený. Pokračovať sa dá tlačidlom „Pokračovať“.`,
            ]),
            status: 'stopped',
          },
          overrideAccess: true,
        })

        return json({ halted: 'limit', ok: true, status: 'stopped' })
      }
    } else if (job.status === 'importing' && !isHeartbeatStale(job.heartbeatAt)) {
      // Kopnutie zvonku do bežiacej reťaze by vyrobilo druhú reťaz na tej
      // istej fronte. Úloha už beží — netreba robiť nič.
      return json({ alreadyRunning: true, counters, ok: true, status: 'importing' })
    }

    // Úloha sa označí za bežiacu HNEĎ, nie až po dobehnutí dávky. Bez toho by
    // medzi kliknutím a koncom prvej dávky (desiatky sekúnd) prešla kontrola
    // vyššie aj druhému kliknutiu a na tej istej fronte by bežali dve reťaze.
    await payload.update({
      collection: 'scraper-jobs',
      id: jobId,
      data: { heartbeatAt: new Date().toISOString(), status: 'importing' },
      overrideAccess: true,
    })
  }

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

  // Vybrané kategórie (Z14): prehľadávanie sa nimi NAPLNÍ, takže `discover`
  // ide rovno do vetvy „pokračuj v známych kategóriách" a na nič iné v obchode
  // sa nepozrie. Prázdny výber = celý obchod, presne ako pred Z14.
  const selectedCategories = categoryMap.filter((entry) => entry.selected).map((entry) => entry.url)

  if (!state.productUrls.length && !state.categories.length && selectedCategories.length) {
    state = {
      categories: selectedCategories,
      complete: false,
      productUrls: [],
      strategy: strategyForCategories(selectedCategories),
    }

    logLines.push(`Prehľadávajú sa len vybrané kategórie (${selectedCategories.length}).`)
  }

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

    // Kopnutie zvonku (nie z reťaze) je zároveň „začni / pokračuj": vtedy sa
    // počítadlo reťazenia nuluje, ale len ak úloha naozaj nebežala. Kopnutie
    // do zaseknutej reťaze (starý tep, stav „importuje sa") ho necháva tak,
    // aby sa strop nedal obísť opakovaným klikaním.
    const chainCount = !isChainCall && job.status !== 'importing' ? 0 : job.chainCount ?? 0
    const endpoint = runEndpointFrom(request)
    const heartbeatAt = new Date().toISOString()

    /**
     * Uloží stav dávky a keď je čo robiť ďalej, objedná si ďalšiu dávku.
     *
     * Objednávka ide cez `after()`, teda AŽ po odoslaní odpovede: kým beží
     * `fetch` na seba samého, toto volanie by inak držalo otvorené spojenie s
     * prehliadačom a zbytočne mu blokovalo `keep-alive`.
     */
    const finish = async (result: {
      done: boolean
      extraLog: string[]
      nextCursor: number
      processed: number
    }): Promise<Response> => {
      // Stav sa musí prečítať ZNOVA: tlačidlo „Zastaviť" mohlo prepnúť úlohu,
      // kým dávka bežala, a zápis nižšie by ho prepísal späť na „importuje sa".
      const fresh = (await payload.findByID({
        collection: 'scraper-jobs',
        id: jobId,
        depth: 0,
        overrideAccess: true,
      })) as ScraperJob

      const stopped = fresh.status === 'stopped'
      const status = result.done ? 'done' : stopped ? 'stopped' : 'importing'
      const willChain = !result.done && !stopped && chainCount < CHAIN_LIMIT
      const lines = [...logLines, ...result.extraLog]

      if (stopped) lines.push('Reťaz zastavená na žiadosť.')
      if (!result.done && !stopped && !internalToken()) {
        lines.push('POZOR: SCRAPER_INTERNAL_TOKEN nie je nastavený — import ďalej sám nepokračuje.')
      }

      await payload.update({
        collection: 'scraper-jobs',
        id: jobId,
        data: {
          chainCount: willChain ? chainCount + 1 : chainCount,
          counters,
          cursor: result.nextCursor,
          detectedLanguage,
          heartbeatAt,
          log: appendLog(fresh.log ?? job.log, lines),
          productLinks: state,
          status,
        },
        overrideAccess: true,
      })

      if (willChain) {
        after(async () => {
          const outcome = await kickBatch({
            endpoint,
            expectCursor: result.nextCursor,
            jobId,
            onError: (message) => payload.logger.error(`[scraper] ${message}`),
          })

          if (outcome === 'disabled') {
            payload.logger.warn(
              '[scraper] SCRAPER_INTERNAL_TOKEN nie je nastavený — reťaz dávok sa nespustila.',
            )
          }
        })
      }

      return json({
        chained: willChain,
        counters,
        done: result.done,
        ok: true,
        processed: result.processed,
        remaining: Math.max(0, queue.length - result.nextCursor),
        status,
        total: queue.length,
      })
    }

    if (!slice.length) {
      // Prázdna fronta ešte nemusí znamenať koniec: keď sa zoznam produktov
      // stále dopĺňa (veľký katalóg, prerušené prehľadávanie), ďalšie volanie
      // najprv dohľadá ďalšie kategórie a až potom sa importuje.
      const finished = state.complete

      return finish({
        done: finished,
        extraLog: [
          finished
            ? 'Fronta je prázdna — import je hotový.'
            : 'Fronta je dočasne prázdna, pokračuje sa v prehľadávaní zdroja.',
        ],
        nextCursor: cursor,
        processed: 0,
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
    const batchLog: string[] = []

    for (const failure of result.failures) {
      handled.add(failure.url)
      batchLog.push(`Nepodarilo sa načítať ${failure.url}: ${failure.message}`)
    }

    // Sťahovanie fotiek (sekunda na fotku, až osem na produkt) je tá časť
    // dávky, ktorá sa najľahšie natiahne cez limit volania — preto sa pred
    // každým ďalším produktom pozerá na hodiny.
    for (const [index, item] of result.items.entries()) {
      if (index > 0 && Date.now() - startedAt > IMPORT_DEADLINE_MS) {
        batchLog.push(
          `Zvyšok dávky (${result.items.length - index}) sa odkladá do ďalšieho kroku — dochádza čas volania.`,
        )
        break
      }

      const outcome = await importProduct(payload, item)

      if (outcome.status === 'created') counters.imported++
      else if (outcome.status === 'skipped') {
        // Rozlíšenie, ktoré si vyžiadala majiteľka: „už sme to sťahovali"
        // (idempotencia) vs. „taký produkt už predávam" (Z14).
        if (outcome.reason === 'existing') counters.skippedExisting++
        else counters.skipped++
      } else counters.failed++

      handled.add(item.scraped.sourceUrl)
      batchLog.push(outcome.message)
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

    batchLog.push(
      `Dávka ${cursor + 1}–${nextCursor} z ${queue.length}${
        state.complete ? '' : ' (zoznam sa ešte dopĺňa)'
      }${done ? ' — hotovo.' : '.'}`,
    )

    return finish({ done, extraLog: batchLog, nextCursor, processed })
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
