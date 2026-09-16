import type { ScraperJob } from '@/payload-types'

import configPromise from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { checkRole } from '@/access/utilities'
import {
  BATCH_BUDGET_MS,
  CHAIN_LIMIT,
  hasInternalToken,
  hasTimeFor,
  internalToken,
  isHeartbeatStale,
  kickBatch,
  PREVIEW_BUDGET_MS,
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
import {
  translateCategoryNames,
  TRANSLATION_CHUNK_SIZE,
  TRANSLATION_MIN_TIMEOUT_MS,
} from '@/scraper/translate'
import type { CategoryMapEntry, ProductPreview } from '@/scraper/types'

/**
 * POST /api/scraper/run — jeden krok importu z cudzieho e-shopu (Z12, Z14, Z16).
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
 *                Ostáva SYNCHRÓNNY, lebo majiteľka pri ňom čaká na výsledok.
 * `batch`      — overí brzdy, označí úlohu za bežiacu, odpovie **202** a
 *                spracuje dávku AŽ PO ODPOVEDI, v `after()`.
 * `stop`       — prepne stav na „zastavené"; bežiaca reťaz sa na začiatku
 *                nasledujúcej dávky vzdá.
 *
 * **Prečo 202 a práca po odpovedi (Z16).** Do Z15 dávka bežala vnútri
 * požiadavky: prehliadač (a pri reťazení rodičovská dávka) držal otvorené
 * spojenie desiatky sekúnd a keď sa dávka nezmestila do limitu funkcie,
 * platforma ju zabila — majiteľka dostala HTTP 504 a nemala z odpovede nič.
 * Teraz je odpoveď okamžitá a nesie len „prijaté, sleduj úlohu"; admin panel
 * aj tak už od Z14 číta stav z dokumentu úlohy, nie z tejto odpovede. Práca
 * beží v `after()` — v tom istom primitíve Next 16, ktorým si reťaz už predtým
 * objednávala ďalšiu dávku.
 *
 * **Jeden rozpočet na celú prácu (Z16).** `BATCH_BUDGET_MS` kryje sťahovanie,
 * preklad, fotky aj zápisy. Po jeho vyčerpaní sa nič nové nezačína a zvyšok
 * fronty ostáva ďalšiemu článku reťaze; kurzor sa posúva len o SÚVISLÝ ÚSEK
 * naozaj vybavených adries. `batchSize` je len horný strop na jeden článok.
 *
 * **Autorizácia.** Buď prihlásená administrátorka, alebo hlavička
 * `Authorization: Bearer <SCRAPER_INTERNAL_TOKEN>` — tú používa reťaz a denný
 * záchranný beh `/api/scraper/tick`, kde žiadna relácia neexistuje.
 *
 * Zdvorilosť k cudziemu serveru (≥ 1 s medzi požiadavkami) je zabudovaná v
 * `pipeline`/`discover`/`importProduct`, takže platí bez ohľadu na to, kto
 * ich volá.
 */

export const dynamic = 'force-dynamic'

/**
 * Strop platformy, nie náš pracovný čas.
 *
 * Skutočnú dĺžku práce určuje `BATCH_BUDGET_MS` (40 s). `maxDuration` je len
 * poistka pre platformu: tarifa si ju smie zrezať (na Hobby na 60 s) a keď to
 * spraví, náš rozpočet je aj tak hlboko pod ňou. Dôležité je, že ju platforma
 * NEZREŽE pod dobeh rozbehnutého produktu.
 */
export const maxDuration = 300

type RunBody = {
  chain?: unknown
  expectCursor?: unknown
  jobId?: unknown
  mode?: unknown
}

type Mode = 'batch' | 'categories' | 'preview' | 'stop'

/** Koľko produktov ide do testovacieho behu. Menej sa ich ukáže len pri nedostatku času. */
const PREVIEW_SIZE = 3

/**
 * Koľko z rozpočtu smie zjesť prehľadávanie zdroja.
 *
 * Zvyšok potrebuje sťahovanie a preklad produktov (a pri dávke aj sťahovanie
 * fotiek), takže prehľadávanie sa po tomto čase zastaví a neprejdené kategórie
 * odloží do `productLinks` — ďalšie volanie v nich pokračuje.
 */
const DISCOVERY_BUDGET_MS = 15_000

/**
 * Koľko času sa necháva po preklade na zápis produktov.
 *
 * Nie je to celý čas importu (fotky a zápis trvajú aj 15 s), ale toľko, aby sa
 * zápis aspoň jedného preloženého produktu stihol ZAČAŤ. Rozbehnutý produkt sa
 * potom dokončí aj po uplynutí rozpočtu — prerušiť ho uprostred zakladania
 * fotogalérie by nechalo v systéme polovičný produkt.
 */
const IMPORT_RESERVE_MS = 6_000

/**
 * Pod týmto zvyškom rozpočtu sa už nová skupinka produktov nezačína.
 *
 * Skupinka potrebuje stiahnuť stránku, preložiť ju a začať zápis. Keď na to
 * nie je čas, je lacnejšie skončiť článok reťaze a nechať prácu tomu ďalšiemu,
 * ktorý začína s plným rozpočtom, než minúť pokus na volanie, ktoré vyprší.
 */
const MIN_GROUP_MS = TRANSLATION_MIN_TIMEOUT_MS + IMPORT_RESERVE_MS + 4_000

/**
 * To isté pre testovací beh, ktorý nič neimportuje.
 *
 * Bez zápisu produktov netreba rezervu na fotky a databázu — stačí stiahnuť
 * stránky a preložiť. Preto sa do rozpočtu testu zmestí tretí produkt aj vtedy,
 * keď by sa doň dávka už nepustila.
 */
const MIN_PREVIEW_GROUP_MS = TRANSLATION_MIN_TIMEOUT_MS + 4_000

/**
 * Koľkokrát sa produkt pokúsi preložiť, kým sa zaráta medzi chyby.
 *
 * Tri pokusy sú kompromis: prvý beží v dvojici, druhý a tretí už sám (celý
 * rozpočet pre jeden produkt), takže sa vyčerpajú dve rôzne stratégie. Keď ani
 * to nestačí, je na produkte niečo trvalé a ďalšie opakovanie by len zdržiavalo
 * celý import. Vtedy sa produkt prejde a zaráta do počítadla „Chyby".
 */
const MAX_TRANSLATION_ATTEMPTS = 3

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

/**
 * Počítadlo neúspešných pokusov o preklad, kľúčované adresou produktu.
 *
 * Býva v tom istom `json` poli ako fronta (`productLinks`) a nie vo vlastnom
 * stĺpci: je to prevádzkový údaj jednej úlohy, ktorý musí prežiť medzi dvomi
 * článkami reťaze (medzi nimi neexistuje žiadna pamäť procesu), a nová kolóna
 * v kolekcii by si vyžiadala migráciu kvôli číslu, ktoré sa po dokončení
 * produktu aj tak zmaže.
 */
type TranslationAttempts = Record<string, number>

type QueueState = { attempts: TranslationAttempts; state: DiscoverResult }

const EMPTY_STATE: DiscoverResult = {
  categories: [],
  complete: false,
  productUrls: [],
  strategy: 'shoper',
}

/**
 * `productLinks` → fronta + počítadlo pokusov.
 *
 * Historicky sa do poľa ukladalo holé pole adries; taký dokument sa načíta aj
 * teraz a len sa doplní o „prehľadané do konca".
 */
const readQueueState = (value: unknown): QueueState => {
  if (Array.isArray(value)) {
    return {
      attempts: {},
      state: { categories: [], complete: true, productUrls: value as string[], strategy: 'shoper' },
    }
  }

  if (!value || typeof value !== 'object') return { attempts: {}, state: { ...EMPTY_STATE } }

  const raw = value as Record<string, unknown>
  const attemptsRaw = raw.translationAttempts
  const attempts: TranslationAttempts = {}

  if (attemptsRaw && typeof attemptsRaw === 'object') {
    for (const [url, count] of Object.entries(attemptsRaw as Record<string, unknown>)) {
      if (typeof count === 'number' && count > 0) attempts[url] = count
    }
  }

  return {
    attempts,
    state: {
      categories: Array.isArray(raw.categories) ? (raw.categories as string[]) : [],
      complete: raw.complete === true,
      productUrls: Array.isArray(raw.productUrls) ? (raw.productUrls as string[]) : [],
      strategy: (raw.strategy as DiscoverResult['strategy']) ?? 'shoper',
    },
  }
}

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
  // Z16: horný strop je 5, nie 10. Nad päť produktov sa jeden článok reťaze
  // nedostane ani pri krátkych popisoch a väčšia dávka len predstiera, že sa
  // niečo zrýchli.
  const batchSize = Math.min(5, Math.max(1, job.batchSize ?? 3))
  const fallbackRate = job.fallbackRate ?? 4.3

  const categoryMap = readCategoryMap(job.categoryMap)

  let detectedLanguage = job.detectedLanguage ?? null

  // --- zoznam kategórií (Z14) -----------------------------------------------
  if (mode === 'categories') {
    const logLines: string[] = []

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

  /**
   * Výsledok jednej práce (testovacieho behu alebo dávky).
   *
   * Dávka ho už nikomu nevracia — beží v `after()`, keď je odpoveď dávno preč —
   * ale testovací beh z neho skladá svoju odpoveď a mať pre obe vetvy jeden
   * tvar znamená, že sa dá aj jeden kód.
   */
  type WorkResult = { body: Record<string, unknown>; status: number }

  const endpoint = runEndpointFrom(request)

  /**
   * Celá práca jedného volania: prehľadanie zdroja + spracovanie produktov.
   *
   * Rozpočet sa počíta od VSTUPU do tejto funkcie, nie od príchodu požiadavky:
   * pri dávke sa spúšťa až po odoslaní odpovede a čas strávený autorizáciou a
   * načítaním dokumentu s ním nemá nič spoločné.
   */
  const work = async (kind: 'batch' | 'preview'): Promise<WorkResult> => {
    const startedAt = Date.now()
    const deadlineAt = startedAt + (kind === 'batch' ? BATCH_BUDGET_MS : PREVIEW_BUDGET_MS)
    const logLines: string[] = []

    const { attempts, state: initialState } = readQueueState(job.productLinks)

    let state = initialState

    // Vybrané kategórie (Z14): prehľadávanie sa nimi NAPLNÍ, takže `discover`
    // ide rovno do vetvy „pokračuj v známych kategóriách" a na nič iné v obchode
    // sa nepozrie. Prázdny výber = celý obchod, presne ako pred Z14.
    const selectedCategories = categoryMap
      .filter((entry) => entry.selected)
      .map((entry) => entry.url)

    if (!state.productUrls.length && !state.categories.length && selectedCategories.length) {
      state = {
        categories: selectedCategories,
        complete: false,
        productUrls: [],
        strategy: strategyForCategories(selectedCategories),
      }

      logLines.push(`Prehľadávajú sa len vybrané kategórie (${selectedCategories.length}).`)
    }

    /** Fronta + počítadlo pokusov v jednom `json` poli. */
    const queueForStorage = (): Record<string, unknown> => ({ ...state, translationAttempts: attempts })

    try {
      // --- naplnenie fronty + rozpoznanie jazyka ----------------------------
      //
      // Prehľadávanie sa musí zmestiť do rozpočtu AJ so sekundovou pauzou medzi
      // požiadavkami, takže dostáva iba časť času a pri jeho vyčerpaní odloží
      // zvyšné kategórie do `state.categories`. Testovací beh tak vie ukázať
      // náhľady hneď z prvých nájdených produktov a zvyšok katalógu sa dohľadá
      // počas dávok — to je aj dôvod, prečo je `discovered` priebežne rastúce
      // číslo a nie konečný súčet hneď na začiatku.
      if (!state.productUrls.length || !state.complete) {
        await payload.update({
          collection: 'scraper-jobs',
          id: jobId,
          data: { status: kind === 'preview' ? 'preview_running' : 'importing' },
          overrideAccess: true,
        })

        if (!detectedLanguage) {
          const entry = await tryFetchPage(sourceUrl)

          if (entry) detectedLanguage = await detectLanguage(entry.html)

          logLines.push(`Jazyk zdroja: ${detectedLanguage ?? 'neurčený'}`)
        }

        const before = state.productUrls.length

        state = await discover(sourceUrl, {
          // Prehľadávanie nesmie zjesť rozpočet tak, že na produkty nezostane
          // ani na jednu skupinku — inak by sa reťaz točila a nič by nepribúdalo.
          deadlineAt: Math.min(startedAt + DISCOVERY_BUDGET_MS, deadlineAt - MIN_GROUP_MS),
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

        return {
          body: { message: 'Na zadanej adrese sa nenašiel žiadny produkt.', ok: false },
          status: 200,
        }
      }

      // --- testovací beh ----------------------------------------------------
      if (kind === 'preview') {
        const sample = queue.slice(0, PREVIEW_SIZE)
        const previews: ProductPreview[] = []
        const notes: string[] = []
        let calls = 0
        let inputTokens = 0
        let outputTokens = 0
        let rate: null | number = null
        let rateSource: null | string = null
        let skippedForTime = 0

        // Tá istá disciplína ako pri dávke: po skupinkách a s pohľadom na
        // hodiny. Keď sa tretí produkt nestihne, ukážu sa dva a v logu je
        // napísané prečo — nepreložený náhľad by klamal o tom, ako bude
        // produkt po importe vyzerať.
        for (let offset = 0; offset < sample.length; offset += TRANSLATION_CHUNK_SIZE) {
          const group = sample.slice(offset, offset + TRANSLATION_CHUNK_SIZE)

          if (!hasTimeFor(deadlineAt, MIN_PREVIEW_GROUP_MS)) {
            skippedForTime += sample.length - offset
            break
          }

          const result = await scrapeAndPrepare(group, {
            deadlineAt,
            fallbackRate,
            fromLang: detectedLanguage,
            onProgress: (message) => logLines.push(message),
            reserveMs: 0,
          })

          calls += result.usage.calls
          inputTokens += result.usage.inputTokens
          outputTokens += result.usage.outputTokens

          if (result.rate !== null) {
            rate = result.rate
            rateSource = result.rateSource
          }

          for (const item of result.items) {
            previews.push(toPreview(item.scraped, item.translated, item.priceInEUR))
          }

          for (const failure of result.failures) {
            notes.push(
              failure.cause === 'fetch'
                ? `Nepodarilo sa načítať ${failure.url}: ${failure.message}`
                : `Náhľad sa nevytvoril (${failure.cause}) pre ${failure.url}: ${failure.message}`,
            )
          }

          skippedForTime += result.deferred.length
        }

        if (skippedForTime) {
          notes.push(
            `Na ${skippedForTime} ${
              skippedForTime === 1 ? 'produkt' : 'produkty'
            } z testovacieho behu nezostal v ${Math.round(
              PREVIEW_BUDGET_MS / 1_000,
            )} s čas — ukazujú sa len tie preložené. Spusti test znova, alebo rovno import (ten si čas rozdelí na viac krokov).`,
          )
        }

        logLines.push(
          `Testovací beh: ${previews.length} náhľadov z ${sample.length}, kurz ${
            rate?.toFixed(4) ?? '—'
          } (${
            rateSource === 'live' ? 'živý' : rateSource === 'eur' ? 'bez prepočtu' : 'záložný'
          }), preklad ${calls}× (${inputTokens} + ${outputTokens} tokenov).`,
          ...notes,
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
            productLinks: queueForStorage(),
            status: previews.length ? 'awaiting_confirm' : 'failed',
          },
          overrideAccess: true,
        })

        if (!previews.length) {
          // Radšej chyba než prázdna ukážka: keď sa nepodaril ani jeden
          // preklad, nie je čo potvrdzovať a majiteľka to má vedieť hneď.
          return {
            body: {
              counters,
              message:
                notes[0] ??
                'Testovací beh nevytvoril ani jeden náhľad — pozri sa do poľa „Priebeh“.',
              ok: false,
              previews: [],
              status: 'failed',
            },
            status: 200,
          }
        }

        return {
          body: { counters, ok: true, previews, status: 'awaiting_confirm' },
          status: 200,
        }
      }

      // --- dávkový import ---------------------------------------------------
      const cursor = Math.max(0, job.cursor ?? 0)
      const slice = queue.slice(cursor, cursor + batchSize)

      // Kopnutie zvonku (nie z reťaze) je zároveň „začni / pokračuj": vtedy sa
      // počítadlo reťazenia nuluje, ale len ak úloha naozaj nebežala. Kopnutie
      // do zaseknutej reťaze (starý tep, stav „importuje sa") ho necháva tak,
      // aby sa strop nedal obísť opakovaným klikaním.
      const chainCount = !isChainCall && job.status !== 'importing' ? 0 : (job.chainCount ?? 0)

      /**
       * Uloží stav dávky a keď je čo robiť ďalej, objedná si ďalšiu dávku.
       *
       * Objednávka ide priamo odtiaľto a nie cez ďalší `after()`: celá táto
       * funkcia už beží po odoslaní odpovede, takže žiadne spojenie sa nedrží.
       */
      const finish = async (result: {
        done: boolean
        extraLog: string[]
        nextCursor: number
        processed: number
      }): Promise<WorkResult> => {
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
            heartbeatAt: new Date().toISOString(),
            log: appendLog(fresh.log ?? job.log, lines),
            productLinks: queueForStorage(),
            status,
          },
          overrideAccess: true,
        })

        if (willChain) {
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
        }

        return {
          body: {
            chained: willChain,
            counters,
            done: result.done,
            ok: true,
            processed: result.processed,
            remaining: Math.max(0, queue.length - result.nextCursor),
            status,
            total: queue.length,
          },
          status: 200,
        }
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

      /**
       * Čo sa v tejto dávke naozaj vybavilo — kľúčom je zdrojová adresa.
       *
       * Kurzor sa potom posunie len o SÚVISLÝ ÚSEK vybavených adries od jeho
       * aktuálnej pozície. Preskočiť produkt je totiž neopraviteľná chyba
       * (nikto sa k nemu už nevráti), kým zopakovať ho nestojí nič — import je
       * idempotentný a druhýkrát ho len preskočí.
       */
      const handled = new Set<string>()
      /** Ako dopadla ktorá adresa. Do počítadiel sa premietne až prejdený úsek. */
      const outcomes = new Map<string, 'created' | 'failed' | 'skipped' | 'skippedExisting'>()
      const batchLog: string[] = []

      // Opakovaný preklad ide po jednom produkte: keď dvojica nestihla, jeden
      // produkt dostane celý rozpočet a má podstatne väčšiu šancu.
      const retrying = slice.some((url) => (attempts[url] ?? 0) > 0)
      const chunkSize = retrying ? 1 : TRANSLATION_CHUNK_SIZE

      if (retrying) {
        batchLog.push('Opakovaný preklad — produkty idú po jednom, nech majú celý čas pre seba.')
      }

      let deferredCount = 0

      for (let offset = 0; offset < slice.length; offset += chunkSize) {
        if (!hasTimeFor(deadlineAt, MIN_GROUP_MS)) {
          deferredCount += slice.length - offset
          break
        }

        const group = slice.slice(offset, offset + chunkSize)

        const result = await scrapeAndPrepare(group, {
          chunkSize,
          deadlineAt,
          fallbackRate,
          fromLang: detectedLanguage,
          onProgress: (message) => batchLog.push(message),
          reserveMs: IMPORT_RESERVE_MS,
        })

        deferredCount += result.deferred.length

        for (const failure of result.failures) {
          if (failure.cause === 'fetch') {
            // Stránka sa nestiahla ani po opakovaní vo `fetchPage` — to sa
            // ďalším pokusom nezmení a produkt by len blokoval frontu.
            handled.add(failure.url)
            outcomes.set(failure.url, 'failed')
            batchLog.push(`Nepodarilo sa načítať ${failure.url}: ${failure.message}`)
            continue
          }

          const attempt = (attempts[failure.url] ?? 0) + 1

          if (attempt >= MAX_TRANSLATION_ATTEMPTS) {
            // Tretí neúspech: produkt sa VZDÁVA. Nemarkuje sa ako preložený a
            // neimportuje sa v pôvodnom jazyku — vypadne z fronty (kurzor ho
            // prejde) a je vidieť v počítadle „Chyby" aj v logu.
            delete attempts[failure.url]
            handled.add(failure.url)
            outcomes.set(failure.url, 'failed')
            batchLog.push(
              `Preklad zlyhal ${MAX_TRANSLATION_ATTEMPTS}× (${failure.cause}) — produkt sa NEIMPORTUJE a vypadáva z fronty: ${failure.url} — ${failure.message}`,
            )
          } else {
            attempts[failure.url] = attempt
            batchLog.push(
              `Preklad zlyhal (${failure.cause}), pokus ${attempt} z ${MAX_TRANSLATION_ATTEMPTS} — skúsi sa v ďalšom kroku: ${failure.url} — ${failure.message}`,
            )
          }
        }

        // Sťahovanie fotiek (sekunda na fotku, až osem na produkt) je tá časť
        // dávky, ktorá sa najľahšie natiahne cez rozpočet — preto sa pred
        // každým ďalším produktom pozerá na hodiny. Rozbehnutý produkt sa vždy
        // dokončí; polovičný produkt v obchode je horší než minúta navyše.
        for (const [index, item] of result.items.entries()) {
          if (index > 0 && !hasTimeFor(deadlineAt, 0)) {
            deferredCount += result.items.length - index
            break
          }

          const outcome = await importProduct(payload, item)

          if (outcome.status === 'created') outcomes.set(item.scraped.sourceUrl, 'created')
          else if (outcome.status === 'skipped') {
            // Rozlíšenie, ktoré si vyžiadala majiteľka: „už sme to sťahovali"
            // (idempotencia) vs. „taký produkt už predávam" (Z14).
            outcomes.set(
              item.scraped.sourceUrl,
              outcome.reason === 'existing' ? 'skippedExisting' : 'skipped',
            )
          } else outcomes.set(item.scraped.sourceUrl, 'failed')

          // Podarený produkt ruší históriu neúspešných pokusov.
          delete attempts[item.scraped.sourceUrl]
          handled.add(item.scraped.sourceUrl)
          batchLog.push(outcome.message)
        }
      }

      let processed = 0

      while (processed < slice.length && handled.has(slice[processed]!)) processed++

      // Do počítadiel ide LEN prejdený úsek. Produkt za prvou nevybavenou
      // adresou sa v ďalšom kroku spracuje znova (import je idempotentný) a bez
      // tohto obmedzenia by sa započítal dvakrát.
      for (const url of slice.slice(0, processed)) {
        const outcome = outcomes.get(url)

        if (outcome === 'created') counters.imported++
        else if (outcome === 'skipped') counters.skipped++
        else if (outcome === 'skippedExisting') counters.skippedExisting++
        else if (outcome === 'failed') counters.failed++
      }

      if (deferredCount) {
        // Bežný, nie poplašný stav: krok má pevný rozpočet a čo sa doň
        // nezmestilo, spracuje nasledujúci. Nič sa nestráca ani nepreskakuje.
        batchLog.push(`Zvyšok dávky (${deferredCount}) pokračuje v ďalšom kroku.`)
      }

      const nextCursor = cursor + processed
      // Hotovo je to až vtedy, keď je prejdená fronta AJ dohľadané kategórie —
      // inak by sa import vyhlásil za dokončený uprostred katalógu.
      const done = nextCursor >= queue.length && state.complete

      batchLog.push(
        `${
          processed
            ? `Dávka ${cursor + 1}–${nextCursor} z ${queue.length}`
            : `Dávka na pozícii ${cursor + 1} z ${queue.length} neposunula frontu`
        }${state.complete ? '' : ' (zoznam sa ešte dopĺňa)'}${
          done ? ' — hotovo.' : '.'
        } Trvala ${Math.round((Date.now() - startedAt) / 1_000)} s.`,
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
            productLinks: queueForStorage(),
            status: 'failed',
          },
          overrideAccess: true,
        })
        .catch(() => undefined)

      return { body: { message, ok: false }, status: 500 }
    }
  }

  // --- testovací beh: synchrónne --------------------------------------------
  if (mode === 'preview') {
    const result = await work('preview')

    return json(result.body, result.status)
  }

  // --- brzdy reťaze ---------------------------------------------------------
  //
  // Všetky sa vyhodnocujú PRED akoukoľvek prácou, aby zastavená či zdvojená
  // reťaz nestihla siahnuť von na cudzí server ani na model. Že sa práca
  // presunula za odpoveď, na tom nič nemení — brzdy sú stále tu, v obsluhe
  // požiadavky, a keď zaberú, `after()` sa vôbec neregistruje.
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

  // Úloha sa označí za bežiacu HNEĎ, ešte pred odpoveďou. Bez toho by medzi
  // kliknutím a prvým zápisom dávky prešla kontrola vyššie aj druhému kliknutiu
  // a na tej istej fronte by bežali dve reťaze.
  await payload.update({
    collection: 'scraper-jobs',
    id: jobId,
    data: { heartbeatAt: new Date().toISOString(), status: 'importing' },
    overrideAccess: true,
  })

  // Práca beží AŽ PO ODOSLANÍ ODPOVEDE. Odtiaľ sa už nikomu nič nevracia —
  // jediný výstup je dokument úlohy, ktorý admin panel priebežne číta. Preto
  // sa tu chytá aj to, čo by `work` nechytila samo: výnimka, ktorá by odtiaľto
  // ušla, by nechala úlohu naveky v stave „importuje sa" bez riadku v logu a
  // majiteľka by čakala na počítadlá, ktoré sa nepohnú.
  after(async () => {
    try {
      await work('batch')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      payload.logger.error(`[scraper] Úloha ${String(jobId)} spadla po odpovedi: ${message}`)

      await payload
        .update({
          collection: 'scraper-jobs',
          id: jobId,
          data: {
            log: appendLog(job.log, [`CHYBA po odoslaní odpovede: ${message}`]),
            status: 'failed',
          },
          overrideAccess: true,
        })
        .catch(() => undefined)
    }
  })

  return json(
    {
      accepted: true,
      // Aby panel vedel povedať, či import naozaj pobeží sám, alebo bude treba
      // klikať „Pokračovať". Do odpovede sa to zmestí, do logu ide tiež.
      chaining: Boolean(internalToken()),
      counters,
      ok: true,
      status: 'importing',
    },
    202,
  )
}
