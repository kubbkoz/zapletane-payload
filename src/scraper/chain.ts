/**
 * Reťazenie dávok importu na strane servera (Z14).
 *
 * **Problém.** Import stoviek produktov trvá desiatky minút, serverless
 * funkcia má strop 60 s a majiteľka chce zavrieť notebook. Do Z13 slučku
 * točil prehliadač, takže zatvorená karta import zastavila.
 *
 * **Riešenie.** Dávka si po sebe zavolá ďalšiu. Keď route dokončí dávku a
 * fronta ešte nie je prázdna, cez `after()` (Next 16) — teda až po odoslaní
 * odpovede — pošle POST na tú istú routu. Autorizuje sa `SCRAPER_INTERNAL_TOKEN`,
 * lebo v tej chvíli už žiadna prihlásená relácia neexistuje; route preto
 * prijíma buď administrátorskú reláciu, alebo tento token.
 *
 * **Prečo `after()` a nie `waitUntil` z `@vercel/functions`.** Balík
 * `@vercel/functions` v tomto projekte nie je (máme len `@vercel/blob` a
 * `@vercel/postgres`) a `after()` robí to isté bez novej závislosti — je to
 * oficiálne API Next 16 a na Verceli sa mapuje presne na `waitUntil`.
 *
 * **Poistky proti splašenej reťazi.** Reťaz je kód, ktorý vie volať sám seba,
 * takže chyba v podmienke ukončenia by znamenala nekonečný beh za peniaze
 * majiteľky. Preto sú štyri nezávislé brzdy a stačí, aby zabrala ktorákoľvek:
 *
 *   1. `status` — dávka z reťaze beží len pri stave „importuje sa"; tlačidlo
 *      „Zastaviť" prepne stav a ďalšia dávka sa hneď na začiatku vzdá.
 *   2. `expectCursor` — reťazové volanie nesie pozíciu vo fronte, akú po sebe
 *      zanechal rodič. Keď sa nezhoduje, beží už niekto iný a toto volanie
 *      končí. Tým sa nezdvojí ani vtedy, keď sa ten istý článok doručí dvakrát.
 *   3. `chainCount` — tvrdý strop na počet zreťazených dávok jednej úlohy.
 *   4. `heartbeatAt` — kým tep tlčie, nové kopnutie zvonku sa odmietne, takže
 *      nevzniknú dve súbežné reťaze na tej istej úlohe.
 *
 * Keď reťaz aj tak padne (výpadok, reštart, timeout), úloha ostane v stave
 * „importuje sa" so starým tepom. Vtedy ju znova rozbehne buď majiteľka
 * tlačidlom „Pokračovať", alebo denný beh `/api/scraper/tick`.
 *
 * **Z16 — práca sa presunula za odpoveď.** Do Z15 route dávku spracovala a až
 * potom odpovedala, takže prehliadač (a pri reťazení rodičovská dávka) čakal
 * desiatky sekúnd a pri pomalom preklade ho platforma zabila — majiteľka videla
 * HTTP 504. Teraz route pri `mode: 'batch'` iba overí brzdy, označí úlohu za
 * bežiacu, odpovie **202** a CELÚ prácu spraví v `after()`, teda až po odoslaní
 * odpovede. Odpoveď je preto vždy okamžitá a žiadne čakanie sa už nedá
 * odstreliť. Poistky nižšie sa nezmenili — vyhodnocujú sa stále pred prácou.
 */
import { timingSafeEqual } from 'node:crypto'

/** Najviac zreťazených dávok na jednu úlohu. */
export const CHAIN_LIMIT = 500

/**
 * Jeden rozpočet na celú prácu jedného článku reťaze (Z16).
 *
 * Kryje VŠETKO: sťahovanie stránok, preklad, sťahovanie fotiek aj zápisy do
 * databázy. Po jeho vyčerpaní sa nič nové nezačína a nespracované produkty
 * ostávajú vo fronte pre ďalší článok — kurzor sa posunie len o to, čo je
 * naozaj hotové.
 *
 * Prečo 40 s, keď `maxDuration` je 300: rozpočet nemá byť strop platformy, ale
 * bezpečná vzdialenosť od nej. Tarifa môže `maxDuration` zrezať na 60 s a
 * rozbehnutý produkt (posledné fotky + zápis) si po uplynutí rozpočtu ešte
 * chvíľu doberá. Štyridsať sekúnd necháva na ten dobeh dosť aj pri najhoršom
 * strope.
 */
export const BATCH_BUDGET_MS = 40_000

/**
 * Rozpočet testovacieho behu.
 *
 * Testovací beh ostáva SYNCHRÓNNY — majiteľka pri ňom stojí a chce vidieť
 * náhľady — takže musí dobehnúť skôr, než ju prehliadač alebo platforma
 * prestane baviť. Preklad troch dlhých produktov sa do toho nezmestí vždy;
 * vtedy sa ukážu tie, ktoré sa stihli, a do logu sa napíše prečo.
 */
export const PREVIEW_BUDGET_MS = 45_000

/**
 * Po akom tichu sa reťaz považuje za padnutú.
 *
 * Jedna dávka má rozpočet 40 s, takže tri minúty sú štvornásobná rezerva —
 * kratší čas by rozbehol druhú reťaz popri pomalej, ale ešte živej dávke.
 */
export const STALE_HEARTBEAT_MS = 3 * 60 * 1_000

/** Koľko času zostáva do konca rozpočtu; bez rozpočtu „nekonečno". */
export const msLeft = (deadlineAt: null | number | undefined): number =>
  deadlineAt ? deadlineAt - Date.now() : Number.POSITIVE_INFINITY

/** Zostáva v rozpočte aspoň `ms`? */
export const hasTimeFor = (deadlineAt: null | number | undefined, ms: number): boolean =>
  msLeft(deadlineAt) >= ms

/**
 * Koľko čakáme na odovzdanie ďalšej dávky.
 *
 * Nečaká sa na jej DOKONČENIE — to je samostatné volanie funkcie, ktoré si
 * beží ďalej aj potom, čo my prestaneme počúvať. Od Z16 odpovedá dieťa 202-kou
 * hneď po overení bŕzd, takže osem sekúnd je pohodlná rezerva a nie odhad:
 * dozvieme sa naozaj, či bola ďalšia dávka prijatá, alebo odmietnutá.
 */
const HANDOFF_TIMEOUT_MS = 8_000

/** Token z prostredia; prázdny reťazec znamená „reťazenie je vypnuté". */
export const internalToken = (): string => process.env.SCRAPER_INTERNAL_TOKEN?.trim() ?? ''

/**
 * Porovnanie tajomstva v konštantnom čase.
 *
 * `===` na reťazcoch končí pri prvom rozdielnom znaku, takže z času odpovede
 * sa dá token uhádnuť znak po znaku. `timingSafeEqual` vyžaduje rovnakú dĺžku
 * bufferov, preto sa nerovnosť dĺžok rieši zvlášť — dĺžka tajomstva nie je
 * tajomstvo.
 */
const secretEquals = (a: string, b: string): boolean => {
  if (!a || !b) return false

  const left = Buffer.from(a)
  const right = Buffer.from(b)

  return left.length === right.length && timingSafeEqual(left, right)
}

/** Nesie požiadavka platný interný token? */
export const hasInternalToken = (headers: Headers): boolean => {
  const token = internalToken()

  if (!token) return false

  const header = headers.get('authorization') ?? ''
  const bearer = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : ''

  return secretEquals(bearer, token)
}

/** Je tep starší než `STALE_HEARTBEAT_MS` (alebo nebol nikdy)? */
export const isHeartbeatStale = (heartbeatAt: null | string | undefined): boolean => {
  if (!heartbeatAt) return true

  const at = Date.parse(heartbeatAt)

  return !Number.isFinite(at) || Date.now() - at > STALE_HEARTBEAT_MS
}

/**
 * Adresa vlastnej routy.
 *
 * Berie sa z adresy práve spracúvanej požiadavky, nie z `NEXT_PUBLIC_SERVER_URL`:
 * reťaz musí trafiť ten istý beh aplikácie, ktorý ju rozbehol (náhľadové
 * nasadenie Vercelu, lokálny dev na inom porte), a nie verejnú doménu, ktorá
 * môže ukazovať inam.
 */
export const runEndpointFrom = (request: Request): string => {
  try {
    return new URL('/api/scraper/run', request.url).toString()
  } catch {
    return '/api/scraper/run'
  }
}

export type KickResult = 'disabled' | 'failed' | 'handed-off'

/**
 * Pošle požiadavku na ďalšiu dávku a nečaká, ako dopadne.
 *
 * Vracia `handed-off`, keď sa požiadavku podarilo odovzdať (vrátane prípadu,
 * keď sme prestali čakať na odpoveď — to je normálny, očakávaný koniec),
 * `failed` pri sieťovej chybe alebo odmietnutí, `disabled` keď token nie je
 * nastavený a reťazenie teda beží len z prehliadača.
 */
export const kickBatch = async (options: {
  chain?: boolean
  endpoint: string
  expectCursor?: null | number
  jobId: number | string
  onError?: (message: string) => void
}): Promise<KickResult> => {
  const token = internalToken()

  if (!token) return 'disabled'

  try {
    const response = await fetch(options.endpoint, {
      body: JSON.stringify({
        chain: options.chain ?? true,
        expectCursor: options.expectCursor ?? null,
        jobId: options.jobId,
        mode: 'batch',
      }),
      cache: 'no-store',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
    })

    if (!response.ok) {
      options.onError?.(`Ďalšia dávka bola odmietnutá (HTTP ${response.status}).`)

      return 'failed'
    }

    return 'handed-off'
  } catch (error) {
    const name = error instanceof Error ? error.name : ''

    // Od Z16 odpovedá dieťa 202-kou okamžite, takže sem sa už za normálnych
    // okolností nepríde. Keď predsa (studený štart funkcie, zaseknutá sieť),
    // považujeme dávku za odovzdanú: požiadavka odišla a dieťa si ju spracuje
    // vo vlastnom volaní — my na jej odpoveď už len prestávame čakať.
    if (name === 'AbortError' || name === 'TimeoutError') return 'handed-off'

    options.onError?.(
      `Ďalšiu dávku sa nepodarilo odovzdať: ${error instanceof Error ? error.message : String(error)}`,
    )

    return 'failed'
  }
}
