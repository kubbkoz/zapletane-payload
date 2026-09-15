/**
 * Zisťovanie zoznamu produktov na cudzom e-shope (Z12).
 *
 * Vstup je jedna adresa — domovská stránka, kategória alebo rovno produkt.
 * Výstup je deduplikovaný zoznam adries produktov, orezaný na `maxProducts`.
 *
 * Reťazec stratégií (prvá, ktorá niečo nájde, vyhráva):
 *
 *   1. **Platformové heuristiky** — Shoper (`/c/` kategórie, `/p/` produkty)
 *      a WooCommerce (`/product-category/`, `/product/`). Sú lacné (stačí
 *      pozrieť na tvar odkazov) a presné, lebo obe platformy majú adresy
 *      pevne dané jadrom, nie témou.
 *   2. **sitemap.xml** — keď ju zdroj má. Prejde sa aj sitemap index, berú sa
 *      len adresy, ktoré vyzerajú ako produkt.
 *   3. **Generický crawl** — všetky odkazy v rámci domény, zoradené podľa toho,
 *      ako veľmi pripomínajú produkt/kategóriu.
 *
 * Prečo sa nesnažíme byť „úplní": import beží v dávkach a majiteľka pred ním
 * vidí náhľad. Lepšie je vrátiť 300 istých produktov než 900 adries, z ktorých
 * tretina sú blogové články — tie by len míňali preklady a čas.
 *
 * Zdvorilosť: medzi dvomi požiadavkami na cudzí server je vždy pauza
 * (`politeDelay`) a počet stiahnutých stránok je zhora ohraničený
 * `MAX_LISTING_FETCHES`.
 */
import * as cheerio from 'cheerio'

import { politeDelay, tryFetchPage } from './fetchPage'

/** Strop na počet stiahnutých *výpisov* (kategórie + stránkovanie + sitemapy). */
const MAX_LISTING_FETCHES = 60

/** Koľko strán stránkovania sa skúsi na jednu kategóriu, kým sa to vzdá. */
const MAX_PAGES_PER_CATEGORY = 25

/**
 * Stav prehľadávania — zároveň výsledok jedného kroku aj vstup toho ďalšieho.
 *
 * Prečo sa to vôbec dá prerušiť: medzi dvomi požiadavkami na cudzí server je
 * povinná sekundová pauza, takže obchod s 31 kategóriami potrebuje na
 * prejdenie vyše minúty — a serverless funkcia má 60 s. Prehľadávanie preto
 * beží „na hodiny": dokedy môže, zvyšok kategórií odloží do `categories` a
 * `complete: false` povie volajúcemu, že sa má ozvať znova. Tvar je obyčajný
 * JSON, takže sa celý uloží do `scraper-jobs.productLinks` a prežije to, že
 * ďalšiu dávku obslúži úplne iná inštancia funkcie.
 */
export type DiscoverResult = {
  /** Kategórie, ktoré ešte NEBOLI prejdené. Prázdne = nič neostáva. */
  categories: string[]
  /** `false` = došiel čas alebo strop, volaj znova s týmto výsledkom. */
  complete: boolean
  productUrls: string[]
  /** Ako sa produkty našli; ide do logu úlohy. */
  strategy: 'generic' | 'shoper' | 'sitemap' | 'single' | 'woocommerce'
}

export type DiscoverOptions = {
  /**
   * Absolútny čas (`Date.now()`), po ktorom sa už nezačne ďalšia požiadavka.
   * Bez neho beží prehľadávanie až po `MAX_LISTING_FETCHES`.
   */
  deadlineAt?: number
  /** Výsledok predchádzajúceho kroku — prehľadávanie sa v ňom pokračuje. */
  known?: null | DiscoverResult
  maxProducts?: number
  /** Voliteľný odber priebehu (log do úlohy). */
  onProgress?: (message: string) => void
}

const sameHost = (url: string, base: URL): boolean => {
  try {
    return new URL(url).host === base.host
  } catch {
    return false
  }
}

const normalize = (url: string): string => {
  try {
    const parsed = new URL(url)

    parsed.hash = ''
    // Shoper aj Woo pridávajú do odkazov sledovacie parametre; bez ich
    // odstránenia by ten istý produkt vošiel do fronty aj päťkrát.
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|srsltid)/i.test(key)) parsed.searchParams.delete(key)
    }

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

const collectLinks = (html: string, pageUrl: string, base: URL): string[] => {
  const $ = cheerio.load(html)
  const out: string[] = []

  $('a[href]').each((_, node) => {
    const href = $(node).attr('href')

    if (!href) return

    try {
      const absolute = new URL(href, pageUrl).toString()

      if (sameHost(absolute, base)) out.push(normalize(absolute))
    } catch {
      // neplatný href
    }
  })

  return out
}

// --- rozpoznanie tvaru adresy ---------------------------------------------

const SHOPER_PRODUCT = /\/p\/[^/]+\/\d+(?:$|[?#])/i
const SHOPER_CATEGORY = /\/c\/[^/]+\/\d+(?:$|\/\d+)?(?:$|[?#])/i
const WOO_PRODUCT = /\/product\/[^/]+\/?$/i
const WOO_CATEGORY = /\/product-category\/[^?#]+$/i
const GENERIC_PRODUCT = /\/(produkt|product|produkty|products|item|detail|zbozi|tovar)\//i

export const isShoperProduct = (url: string): boolean => SHOPER_PRODUCT.test(url)
export const isShoperCategory = (url: string): boolean => SHOPER_CATEGORY.test(url)

/**
 * Ďalšia strana Shoper kategórie: `/pl/c/<Názov>/<id>` → `/pl/c/<Názov>/<id>/2`.
 * Keď už adresa číslo strany má, len ho zvýši.
 */
export const shoperPageUrl = (categoryUrl: string, page: number): string => {
  // `…/c/<Názov>/<id>` alebo už ostránkované `…/c/<Názov>/<id>/<strana>`.
  const match = categoryUrl.match(/^(.*\/c\/[^/]+\/\d+)(?:\/\d+)?\/?$/i)
  const root = match ? match[1]! : categoryUrl.replace(/\/$/, '')

  return page <= 1 ? root : `${root}/${page}`
}

// --- sitemap ---------------------------------------------------------------

const readSitemap = async (
  base: URL,
  budget: { fetches: number },
  onProgress?: (message: string) => void,
): Promise<string[]> => {
  const queue = [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`]
  const seen = new Set<string>()
  const urls: string[] = []

  while (queue.length && budget.fetches < MAX_LISTING_FETCHES) {
    const current = queue.shift()!

    if (seen.has(current)) continue

    seen.add(current)
    budget.fetches++

    const page = await tryFetchPage(current)

    await politeDelay()

    if (!page || !/xml/i.test(page.contentType || '')) continue

    onProgress?.(`Sitemap: ${current}`)

    const $ = cheerio.load(page.html, { xmlMode: true })

    $('sitemap > loc').each((_, node) => {
      const value = $(node).text().trim()

      if (value && !seen.has(value) && queue.length < 10) queue.push(value)
    })

    $('url > loc').each((_, node) => {
      const value = $(node).text().trim()

      if (value && sameHost(value, base)) urls.push(normalize(value))
    })
  }

  return urls
}

// --- prechod kategórií -----------------------------------------------------

/**
 * Prejde kategórie z `pending` a doplní nájdené produkty.
 *
 * Kategórie sa z `pending` odoberajú AŽ po dokončení celej svojej stránkovanej
 * série — vďaka tomu je zvyšok poľa vždy presne to, čo ešte treba prejsť, a
 * ďalší krok môže pokračovať bez toho, aby niektorú preskočil alebo zopakoval.
 *
 * Vracia zvyšné (neprejdené) kategórie.
 */
const crawlCategories = async ({
  addProducts,
  base,
  budget,
  isProduct,
  log,
  maxProducts,
  outOfTime,
  pending,
  products,
  shoper,
}: {
  addProducts: (urls: string[]) => void
  base: URL
  budget: { fetches: number }
  isProduct: (url: string) => boolean
  log?: (message: string) => void
  maxProducts: number
  outOfTime: () => boolean
  pending: string[]
  products: Set<string>
  shoper: boolean
}): Promise<string[]> => {
  while (pending.length) {
    if (products.size >= maxProducts) return []
    if (budget.fetches >= MAX_LISTING_FETCHES || outOfTime()) return [...pending]

    const category = pending[0]!

    for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page++) {
      if (products.size >= maxProducts) return []
      if (budget.fetches >= MAX_LISTING_FETCHES || outOfTime()) return [...pending]

      const pageUrl = shoper
        ? shoperPageUrl(category, page)
        : page === 1
          ? category
          : `${category.replace(/\/$/, '')}/page/${page}/`

      budget.fetches++

      const listing = await tryFetchPage(pageUrl)

      await politeDelay()

      if (!listing) break

      const found = collectLinks(listing.html, listing.finalUrl, base).filter(isProduct)
      const fresh = found.filter((url) => !products.has(url))

      addProducts(found)

      log?.(`${pageUrl} → ${found.length} produktov (${fresh.length} nových)`)

      // Shoper pri prekročení poslednej strany vráti prvú stranu (rovnaké
      // produkty) namiesto 404 — prázdny prírastok je preto jediný spoľahlivý
      // signál konca stránkovania.
      if (!fresh.length) break
    }

    pending.shift()
  }

  return []
}

// --- verejné API -----------------------------------------------------------

export const discover = async (
  startUrl: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> => {
  const maxProducts = Math.max(1, options.maxProducts ?? 500)
  const log = options.onProgress
  const base = new URL(startUrl)
  const budget = { fetches: 0 }
  const known = options.known

  /** Došiel čas? Kontroluje sa PRED každou požiadavkou, nie po nej. */
  const outOfTime = (): boolean =>
    typeof options.deadlineAt === 'number' && Date.now() >= options.deadlineAt

  const products = new Set<string>(known?.productUrls ?? [])
  const pending: string[] = [...(known?.categories ?? [])]

  const addProducts = (urls: string[]) => {
    for (const url of urls) {
      if (products.size >= maxProducts) return
      products.add(url)
    }
  }

  // Zadaná adresa je rovno produkt → netreba nič prehľadávať.
  if (isShoperProduct(startUrl) || WOO_PRODUCT.test(startUrl)) {
    return {
      categories: [],
      complete: true,
      productUrls: [normalize(startUrl)],
      strategy: 'single',
    }
  }

  // --- pokračovanie prerušeného behu ---------------------------------------
  // Úvodná stránka sa už raz stiahla, kategórie sú uložené — netreba ju čítať
  // znova, stačí dojsť zvyšok zoznamu.
  if (known && known.strategy !== 'generic' && known.strategy !== 'sitemap') {
    const isProduct =
      known.strategy === 'woocommerce' ? (url: string) => WOO_PRODUCT.test(url) : isShoperProduct

    const remaining = await crawlCategories({
      addProducts,
      base,
      budget,
      isProduct,
      log,
      maxProducts,
      outOfTime,
      pending,
      products,
      shoper: known.strategy === 'shoper',
    })

    return {
      categories: remaining,
      complete: remaining.length === 0,
      productUrls: [...products],
      strategy: known.strategy,
    }
  }

  budget.fetches++

  const entry = await tryFetchPage(startUrl)

  if (!entry) throw new Error(`Stránku ${startUrl} sa nepodarilo stiahnuť.`)

  await politeDelay()

  const entryLinks = collectLinks(entry.html, entry.finalUrl, base)

  addProducts(entryLinks.filter(isShoperProduct))

  for (const link of entryLinks) {
    const category = isShoperCategory(link)
      ? shoperPageUrl(link, 1)
      : WOO_CATEGORY.test(link)
        ? link
        : null

    if (category && !pending.includes(category)) pending.push(category)
  }

  const shoper = entryLinks.some(isShoperProduct) || entryLinks.some(isShoperCategory)
  const woo = entryLinks.some((link) => WOO_PRODUCT.test(link) || WOO_CATEGORY.test(link))

  // --- 1) platformové heuristiky ------------------------------------------
  if (shoper || woo) {
    const strategy: DiscoverResult['strategy'] = shoper ? 'shoper' : 'woocommerce'

    log?.(`Platforma: ${strategy}, kategórií: ${pending.length}`)

    const remaining = await crawlCategories({
      addProducts,
      base,
      budget,
      isProduct: shoper ? isShoperProduct : (url: string) => WOO_PRODUCT.test(url),
      log,
      maxProducts,
      outOfTime,
      pending,
      products,
      shoper,
    })

    if (products.size) {
      return {
        categories: remaining,
        complete: remaining.length === 0,
        productUrls: [...products],
        strategy,
      }
    }
  }

  // --- 2) sitemap ----------------------------------------------------------
  const sitemapUrls = await readSitemap(base, budget, log)

  if (sitemapUrls.length) {
    const fromSitemap = sitemapUrls.filter(
      (url) => isShoperProduct(url) || WOO_PRODUCT.test(url) || GENERIC_PRODUCT.test(url),
    )

    if (fromSitemap.length) {
      addProducts(fromSitemap)

      // Sitemapa dá celý katalóg naraz — nie je čo odkladať na ďalší krok.
      return { categories: [], complete: true, productUrls: [...products], strategy: 'sitemap' }
    }
  }

  // --- 3) generický crawl --------------------------------------------------
  log?.('Generické prehľadávanie odkazov.')

  const visited = new Set<string>([normalize(startUrl)])
  const queue = entryLinks.filter((url) => GENERIC_PRODUCT.test(url) || /kategor|catego/i.test(url))

  addProducts(entryLinks.filter((url) => GENERIC_PRODUCT.test(url)))

  while (
    queue.length &&
    products.size < maxProducts &&
    budget.fetches < MAX_LISTING_FETCHES &&
    !outOfTime()
  ) {
    const current = queue.shift()!

    if (visited.has(current)) continue

    visited.add(current)
    budget.fetches++

    const page = await tryFetchPage(current)

    await politeDelay()

    if (!page) continue

    const links = collectLinks(page.html, page.finalUrl, base)
    const found = links.filter((url) => GENERIC_PRODUCT.test(url))

    addProducts(found)

    // Stránka, na ktorej je aspoň jeden produkt, je výpis — jej ďalšie odkazy
    // majú zmysel prehľadať; ostatné sa zahodia, aby sa crawl nerozliezol.
    if (found.length) {
      for (const link of links) {
        if (!visited.has(link) && /kategor|catego|shop|sklep|obchod/i.test(link)) queue.push(link)
      }
    }
  }

  // Generický crawl nemá stabilný „zvyšok kategórií", ktorý by sa dal odložiť:
  // fronta vzniká z odkazov, na ktoré sa práve narazilo. Preto sa vracia ako
  // dokončený a čo našiel, to našiel — pri takom zdroji je aj tak namieste
  // dať majiteľke radšej presnú adresu kategórie.
  return { categories: [], complete: true, productUrls: [...products], strategy: 'generic' }
}
