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
 */
import { timingSafeEqual } from 'node:crypto'

/** Najviac zreťazených dávok na jednu úlohu. */
export const CHAIN_LIMIT = 500

/**
 * Po akom tichu sa reťaz považuje za padnutú.
 *
 * Jedna dávka má strop 60 s, takže tri minúty sú trojnásobná rezerva — kratší
 * čas by rozbehol druhú reťaz popri pomalej, ale ešte živej dávke.
 */
export const STALE_HEARTBEAT_MS = 3 * 60 * 1_000

/**
 * Koľko čakáme na odovzdanie ďalšej dávky.
 *
 * Nečaká sa na jej DOKONČENIE — to je samostatné volanie funkcie, ktoré si
 * beží ďalej aj potom, čo my prestaneme počúvať. Osem sekúnd bohato stačí na
 * nadviazanie spojenia a odoslanie tela požiadavky; zvyšok už nie je naša vec
 * a držať kvôli nemu nažive rodičovské volanie by len míňalo čas jeho limitu.
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

    // Prerušenie čakania je očakávaný koniec: dávka sa spracúva ďalej vo
    // vlastnom volaní, len jej odpoveď nás už nezaujíma.
    if (name === 'AbortError' || name === 'TimeoutError') return 'handed-off'

    options.onError?.(
      `Ďalšiu dávku sa nepodarilo odovzdať: ${error instanceof Error ? error.message : String(error)}`,
    )

    return 'failed'
  }
}
