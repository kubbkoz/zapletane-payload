/**
 * Extrakcia jedného produktu zo stiahnutého HTML (Z12).
 *
 * Reťazec stratégií — pre KAŽDÉ pole zvlášť, nie pre stránku ako celok:
 *
 *   1. **JSON-LD** (`application/ld+json`, typ `Product`) — najpresnejší zdroj,
 *      používa ho WooCommerce, PrestaShop, Shopify aj väčšina moderných tém.
 *   2. **Mikrodáta** (`itemscope itemtype=".../Product"` + `itemprop`) — staršia
 *      schéma, na ktorej stojí Shoper (a teda aj wiklinowa-wies.pl).
 *   3. **Open Graph** (`og:title`, `og:description`, `og:image`) — takmer vždy
 *      niečo vráti, ale popis býva skrátený a obrázok len jeden.
 *   4. **DOM heuristiky** — `h1`, `.price`, `#description`, galéria… posledná
 *      záchrana pre šablóny bez akéhokoľvek značkovania.
 *
 * Prvé pole, ktoré dá použiteľnú hodnotu, vyhráva; nižšie stratégie sa už
 * nepýtajú. Vďaka tomu extrakcia nikdy „nezhasne" celá kvôli jednému chýbajúcemu
 * bloku — chýbajúci popis neznamená, že sa stratí cena.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'

import type { ScrapedAttribute, ScrapedProduct } from './types'

/** Maximálny počet obrázkov, ktoré si z jedného produktu vezmeme. */
export const MAX_IMAGES = 8

const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** Absolútna URL z ľubovoľného `href`/`src`; pri nezmysle `null`. */
export const absoluteUrl = (raw: string, base: string): null | string => {
  const value = raw?.trim()

  if (!value || value.startsWith('data:') || value.startsWith('javascript:')) return null

  try {
    const url = new URL(value, base)

    url.hash = ''

    return url.toString()
  } catch {
    return null
  }
}

// --- JSON-LD ---------------------------------------------------------------

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]

const hasType = (node: unknown, type: string): boolean =>
  asArray((node as { '@type'?: unknown })?.['@type']).some(
    (entry) => typeof entry === 'string' && entry.toLowerCase() === type.toLowerCase(),
  )

/** Rekurzívne prejde JSON-LD (vrátane `@graph`) a nájde prvý uzol typu `Product`. */
const findLdProduct = (node: unknown, depth = 0): null | Record<string, unknown> => {
  if (depth > 6 || !node || typeof node !== 'object') return null

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findLdProduct(entry, depth + 1)

      if (found) return found
    }

    return null
  }

  if (hasType(node, 'Product')) return node as Record<string, unknown>

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      const found = findLdProduct(value, depth + 1)

      if (found) return found
    }
  }

  return null
}

const readLdProduct = ($: CheerioAPI): null | Record<string, unknown> => {
  const scripts = $('script[type="application/ld+json"]').toArray()

  for (const script of scripts) {
    const raw = $(script).contents().text().trim()

    if (!raw) continue

    try {
      const found = findLdProduct(JSON.parse(raw))

      if (found) return found
    } catch {
      // Pokazený JSON-LD je bežný (chýbajúca čiarka v šablóne) — ide sa ďalej.
    }
  }

  return null
}

// --- pomocné čítačky -------------------------------------------------------

/**
 * Koreň mikrodát produktu. Dôležité pre stránky, kde je na tej istej stránke
 * aj `BreadcrumbList` (tá má vlastné `itemprop="name"`) — bez zúženia rozsahu
 * by sa ako názov produktu vzal prvý prvok omrviniek („Strona główna").
 */
const productScope = ($: CheerioAPI): cheerio.Cheerio<never> | null => {
  const scope = $('[itemtype*="schema.org/Product"], [itemtype*="schema.org/IndividualProduct"]')

  return scope.length ? (scope.first() as unknown as cheerio.Cheerio<never>) : null
}

/** Hodnota mikrodáta: `content` (meta/link), `href` (link), inak text. */
const microValue = ($: CheerioAPI, element: never): string => {
  const node = $(element)
  const content = node.attr('content')

  if (typeof content === 'string' && content.trim()) return squash(content)

  const href = node.attr('href')

  if (typeof href === 'string' && href.trim()) return href.trim()

  const src = node.attr('src')

  if (typeof src === 'string' && src.trim()) return src.trim()

  return squash(node.text())
}

const readMicro = ($: CheerioAPI, prop: string): null | string => {
  const scope = productScope($)
  const found = scope ? scope.find(`[itemprop="${prop}"]`) : $(`[itemprop="${prop}"]`)

  if (!found.length) return null

  const value = microValue($, found.first()[0] as never)

  return value || null
}

const readMeta = ($: CheerioAPI, property: string): null | string => {
  const value =
    $(`meta[property="${property}"]`).attr('content') ||
    $(`meta[name="${property}"]`).attr('content')

  return value?.trim() ? squash(value) : null
}

// --- cena ------------------------------------------------------------------

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/(zł|zl\b|PLN)/i, 'PLN'],
  [/(€|EUR)/i, 'EUR'],
  [/(Kč|CZK)/i, 'CZK'],
  [/(Ft|HUF)/i, 'HUF'],
  [/(£|GBP)/i, 'GBP'],
  [/(\$|USD)/, 'USD'],
]

/**
 * Číslo z textu ceny. Zvláda „1 234,56 zł", „1,234.56", „280.00" aj „280".
 *
 * Pravidlo pre oddeľovače: posledná čiarka/bodka, po ktorej nasledujú 1–2
 * číslice, je desatinná; všetko ostatné sú oddeľovače tisícov. Tým sa
 * nepomýli „1.299" (tisíce) s „1.29" (haliere).
 */
export const parsePriceNumber = (raw: string): null | number => {
  const text = raw.replace(/ /g, ' ')
  const match = text.match(/\d[\d\s.,]*\d|\d/)

  if (!match) return null

  const digits = match[0].replace(/\s/g, '')
  const lastSeparator = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'))
  const decimals = lastSeparator === -1 ? 0 : digits.length - lastSeparator - 1

  const normalized =
    decimals >= 1 && decimals <= 2
      ? `${digits.slice(0, lastSeparator).replace(/[.,]/g, '')}.${digits.slice(lastSeparator + 1)}`
      : digits.replace(/[.,]/g, '')

  const value = Number(normalized)

  return Number.isFinite(value) && value > 0 ? value : null
}

export const detectCurrency = (raw: string): null | string => {
  for (const [pattern, code] of CURRENCY_SYMBOLS) {
    if (pattern.test(raw)) return code
  }

  return null
}

const readPrice = (
  $: CheerioAPI,
  ld: null | Record<string, unknown>,
): { amount: null | number; currency: null | string } => {
  // 1) JSON-LD offers
  const offer = asArray((ld as { offers?: unknown })?.offers)[0] as
    | Record<string, unknown>
    | undefined

  if (offer) {
    const amount = parsePriceNumber(String(offer.price ?? offer.lowPrice ?? ''))
    const currency = typeof offer.priceCurrency === 'string' ? offer.priceCurrency : null

    if (amount) return { amount, currency: currency?.toUpperCase() ?? null }
  }

  // 2) mikrodáta — najprv v rámci `offers`, aby sa neplietlo `ratingValue`
  const scope = productScope($)
  const offerScope = scope?.find('[itemprop="offers"]')
  const priceNode = (offerScope?.length ? offerScope : (scope ?? $('body')))
    .find('[itemprop="price"]')
    .first()

  if (priceNode.length) {
    const amount = parsePriceNumber(microValue($, priceNode[0] as never))
    const currency =
      (offerScope?.length ? offerScope : (scope ?? $('body')))
        .find('[itemprop="priceCurrency"]')
        .first()
        .attr('content') ?? null

    if (amount) return { amount, currency: currency?.toUpperCase() ?? null }
  }

  // 3) Open Graph (`product:price:amount`) — používa Facebook katalóg
  const ogAmount = readMeta($, 'product:price:amount') ?? readMeta($, 'og:price:amount')

  if (ogAmount) {
    const amount = parsePriceNumber(ogAmount)
    const currency = readMeta($, 'product:price:currency') ?? readMeta($, 'og:price:currency')

    if (amount) return { amount, currency: currency?.toUpperCase() ?? null }
  }

  // 4) DOM heuristika — prvý `.price`-like uzol s číslom a menou
  const candidates = $(
    '.price, .product-price, .current-price, [class*="price"]:not(script):not(style)',
  ).toArray()

  for (const node of candidates.slice(0, 25)) {
    const text = squash($(node).text())

    if (!text || text.length > 60) continue

    const amount = parsePriceNumber(text)
    const currency = detectCurrency(text)

    if (amount && currency) return { amount, currency }
  }

  return { amount: null, currency: null }
}

// --- obrázky ---------------------------------------------------------------

/**
 * Zoznam kandidátov pre jeden obrázok, od najlepšieho rozlíšenia.
 *
 * Shoper ukladá originál do `/userdata/public/gfx/<hash>.<ext>` a zmenšeniny
 * do `/environment/cache/images/productGfx_<hash>_<š>_<v>.<ext>`. Mikrodáta
 * (`<link itemprop="image">`) ukazujú rovno na originál, ale `og:image` a
 * `<img>` v galérii dávajú 500×500 — z tých sa dá originál odvodiť. Keďže
 * odvodenie je odhad (prípona originálu môže byť iná), vracia sa *zoznam*
 * a sťahovanie skúša položky po rade, kým jedna neuspeje.
 */
/**
 * Shoper má DVA tvary ciest k fotke — obidva sú v divočine živé:
 *
 *   starší:  /environment/cache/images/productGfx_<hash>_<š>_<v>.<ext>
 *            originál: /userdata/public/gfx/<hash>.<ext>
 *   novší:   /environment/cache/images/productGfx_<id>_<š>_<v>/<súbor>.<ext>
 *            originál: /userdata/public/gfx/<id>/<súbor>.<ext>
 *
 * Vracia `{ id, file }`, kde `file` je `null` pri staršom tvare. To je zároveň
 * to, čo jednoznačne identifikuje fotku naprieč veľkosťami.
 */
const shoperImageParts = (url: string): null | { file: null | string; id: string; origin: string } => {
  const cacheNew = url.match(
    /^(https?:\/\/[^/]+)\/environment\/cache\/images\/productGfx_(\w+)_\d+_\d+\/([^/?#]+)\.\w+$/i,
  )

  if (cacheNew) return { file: cacheNew[3]!, id: cacheNew[2]!, origin: cacheNew[1]! }

  const cacheOld = url.match(
    /^(https?:\/\/[^/]+)\/environment\/cache\/images\/productGfx_(\w+)_\d+_\d+\.\w+$/i,
  )

  if (cacheOld) return { file: null, id: cacheOld[2]!, origin: cacheOld[1]! }

  const originalNew = url.match(
    /^(https?:\/\/[^/]+)\/userdata\/public\/gfx\/(\w+)\/([^/?#]+)\.\w+$/i,
  )

  if (originalNew) return { file: originalNew[3]!, id: originalNew[2]!, origin: originalNew[1]! }

  const originalOld = url.match(/^(https?:\/\/[^/]+)\/userdata\/public\/gfx\/(\w+)\.\w+$/i)

  if (originalOld) return { file: null, id: originalOld[2]!, origin: originalOld[1]! }

  return null
}

export const imageCandidates = (url: string): string[] => {
  const out: string[] = []
  const push = (value: string) => {
    if (!out.includes(value)) out.push(value)
  }

  const extension = url.match(/\.(\w+)(?:[?#]|$)/)?.[1]?.toLowerCase() ?? 'jpg'
  const shoper = shoperImageParts(url)

  if (shoper) {
    const { file, id, origin } = shoper
    const stem = file ? `${id}/${file}` : id

    // Originál (`/userdata/`) je vždy najlepší zdroj; príponu treba uhádnuť,
    // lebo cache verzia je prekódovaná na webp a pôvodnú príponu zahodila.
    for (const ext of ['jpg', 'png', 'jpeg', 'webp', extension]) {
      push(`${origin}/userdata/public/gfx/${stem}.${ext}`)
    }

    // Keby originál nebol verejný, aspoň najväčšia zmenšenina.
    for (const size of ['1200_1200', '800_800']) {
      push(
        file
          ? `${origin}/environment/cache/images/productGfx_${id}_${size}/${file}.${extension}`
          : `${origin}/environment/cache/images/productGfx_${id}_${size}.${extension}`,
      )
    }
  }

  // WooCommerce/WordPress: `nazov-800x600.jpg` → `nazov.jpg`
  const wp = url.match(/^(.*?)-\d{2,4}x\d{2,4}(\.\w+)$/)

  if (wp) push(`${wp[1]}${wp[2]}`)

  push(url)

  return out
}

/**
 * Kľúč na deduplikáciu: rôzne veľkosti toho istého obrázka sú jeden obrázok.
 *
 * Bez neho sa do galérie dostane `og:image` (500×500 zmenšenina prvej fotky)
 * ako samostatná položka vedľa originálu — overené na wiklinowa-wies.pl, kde
 * `og:image` a `<link itemprop="image">` ukazujú na tú istú fotku dvomi
 * úplne odlišnými cestami.
 */
const imageKey = (url: string): string => {
  const shoper = shoperImageParts(url)

  if (shoper) return `${shoper.id}/${shoper.file ?? ''}`.toLowerCase()

  return url.replace(/-\d{2,4}x\d{2,4}(\.\w+)$/, '$1').toLowerCase()
}

const readImages = ($: CheerioAPI, ld: null | Record<string, unknown>, base: string): string[] => {
  const raw: string[] = []

  for (const entry of asArray((ld as { image?: unknown })?.image)) {
    if (typeof entry === 'string') raw.push(entry)
    else if (entry && typeof entry === 'object') {
      const url = (entry as { url?: unknown }).url

      if (typeof url === 'string') raw.push(url)
    }
  }

  const scope = productScope($)
  const scoped = scope ?? $('body')

  scoped.find('[itemprop="image"]').each((_, node) => {
    const value = microValue($, node as never)

    if (value) raw.push(value)
  })

  const og = readMeta($, 'og:image')

  if (og) raw.push(og)

  // Posledná záchrana: obrázky v galérii podľa bežných tried.
  if (!raw.length) {
    scoped
      .find(
        '.gallery img, .product-gallery img, .woocommerce-product-gallery img, .photos img, figure img',
      )
      .each((_, node) => {
        const el = $(node)
        const value = el.attr('data-large_image') || el.attr('data-src') || el.attr('src')

        if (value) raw.push(value)
      })
  }

  const seen = new Set<string>()
  const images: string[] = []

  for (const entry of raw) {
    const absolute = absoluteUrl(entry, base)

    if (!absolute) continue
    // 1×1 rozostupové gify a placeholdery ignorujeme.
    if (/\/1px\.|placeholder|no_photo|noimage/i.test(absolute)) continue

    const key = imageKey(absolute)

    if (seen.has(key)) continue

    seen.add(key)
    images.push(absolute)

    if (images.length >= MAX_IMAGES) break
  }

  return images
}

// --- popis -----------------------------------------------------------------

/** HTML popisu → odseky čistého textu (`<br>` sa počíta ako zlom riadku). */
export const htmlToParagraphs = (html: string): string[] => {
  if (!html.trim()) return []

  const $ = cheerio.load(`<div id="__root">${html}</div>`)

  $('#__root script, #__root style, #__root iframe').remove()
  $('#__root br').replaceWith('\n')
  $('#__root p, #__root div, #__root li, #__root tr, #__root h1, #__root h2, #__root h3').after('\n')

  return $('#__root')
    .text()
    .split('\n')
    .map((line) => squash(line))
    .filter((line) => line.length > 0)
}

const readDescriptionHtml = ($: CheerioAPI, ld: null | Record<string, unknown>): string => {
  const scope = productScope($)
  const micro = (scope ?? $('body')).find('[itemprop="description"]').first()

  if (micro.length) {
    const inner = micro.html()

    if (inner && squash(cheerio.load(`<div>${inner}</div>`).text()).length > 20) return inner

    const content = micro.attr('content')

    if (content && content.trim().length > 20) return `<p>${content.trim()}</p>`
  }

  const ldDescription = (ld as { description?: unknown })?.description

  if (typeof ldDescription === 'string' && ldDescription.trim().length > 20) {
    return ldDescription.includes('<') ? ldDescription : `<p>${ldDescription.trim()}</p>`
  }

  const domCandidates = [
    '#box_description .innerbox',
    '#description',
    '.product-description',
    '.woocommerce-product-details__short-description',
    '#tab-description',
    '.description',
  ]

  for (const selector of domCandidates) {
    const node = $(selector).first()

    if (!node.length) continue

    const inner = node.html()

    if (inner && squash(cheerio.load(`<div>${inner}</div>`).text()).length > 40) return inner
  }

  const og = readMeta($, 'og:description') ?? readMeta($, 'description')

  return og ? `<p>${og}</p>` : ''
}

// --- omrvinky a parametre --------------------------------------------------

const BREADCRUMB_NOISE =
  /^(strona g[łl][óo]wna|home|hlavn[áa] str[áa]nka|domov|start|sklep|shop|produkty?|products?|katalog|katalóg)$/i

const readCategoryPath = ($: CheerioAPI, title: string): string[] => {
  const names: string[] = []

  // 1) mikrodáta BreadcrumbList
  $('[itemtype*="schema.org/BreadcrumbList"]')
    .first()
    .find('[itemprop="itemListElement"]')
    .each((_, node) => {
      const nameNode = $(node).find('[itemprop="name"]').first()
      const value = nameNode.length ? microValue($, nameNode[0] as never) : ''

      if (value) names.push(value)
    })

  // 2) JSON-LD BreadcrumbList
  if (!names.length) {
    $('script[type="application/ld+json"]').each((_, script) => {
      if (names.length) return

      try {
        const parsed: unknown = JSON.parse($(script).contents().text())
        const list = asArray(parsed).find((entry) => hasType(entry, 'BreadcrumbList')) as
          | Record<string, unknown>
          | undefined

        for (const item of asArray(list?.itemListElement)) {
          const name =
            (item as { name?: unknown })?.name ??
            ((item as { item?: { name?: unknown } })?.item as { name?: unknown })?.name

          if (typeof name === 'string' && name.trim()) names.push(squash(name))
        }
      } catch {
        // ignorujeme
      }
    })
  }

  // 3) DOM heuristika
  if (!names.length) {
    $('.breadcrumb a, .breadcrumbs a, nav[aria-label*="read" i] a, ul.path a').each((_, node) => {
      const value = squash($(node).text())

      if (value) names.push(value)
    })
  }

  const normalizedTitle = title.toLowerCase()

  return names
    .map((name) => squash(name))
    .filter((name) => name.length > 1 && name.length <= 80)
    .filter((name) => !BREADCRUMB_NOISE.test(name))
    .filter((name) => name.toLowerCase() !== normalizedTitle)
}

const ATTRIBUTE_NOISE = /^(cena|price|dostupno|availability|kod|sku|ean|producent do|udost)/i

const readAttributes = ($: CheerioAPI, ld: null | Record<string, unknown>): ScrapedAttribute[] => {
  const attributes: ScrapedAttribute[] = []
  const push = (name: string, value: string) => {
    const cleanName = squash(name).replace(/[:：]\s*$/, '')
    const cleanValue = squash(value)

    if (!cleanName || !cleanValue) return
    if (cleanName.length > 60 || cleanValue.length > 200) return
    if (ATTRIBUTE_NOISE.test(cleanName)) return
    if (attributes.some((entry) => entry.name.toLowerCase() === cleanName.toLowerCase())) return

    attributes.push({ name: cleanName, value: cleanValue })
  }

  // 1) JSON-LD additionalProperty
  for (const entry of asArray((ld as { additionalProperty?: unknown })?.additionalProperty)) {
    const name = (entry as { name?: unknown })?.name
    const value = (entry as { value?: unknown })?.value

    if (typeof name === 'string' && (typeof value === 'string' || typeof value === 'number')) {
      push(name, String(value))
    }
  }

  // 2) mikrodáta additionalProperty / PropertyValue
  $('[itemprop="additionalProperty"]').each((_, node) => {
    const scope = $(node)
    const name = squash(scope.find('[itemprop="name"]').first().text())
    const value = squash(scope.find('[itemprop="value"]').first().text())

    push(name, value)
  })

  // 3) DOM: tabuľky parametrov (Shoper `.projector_attributes`, Woo
  //    `.woocommerce-product-attributes`, PrestaShop `#product-details table`)
  $(
    '.projector_attributes tr, .product-attributes tr, .woocommerce-product-attributes tr, .parameters tr, #box_attributes tr, .data-table tr, .attributes tr',
  ).each((_, node) => {
    const cells = $(node).find('th, td')

    if (cells.length >= 2) push(squash($(cells[0]!).text()), squash($(cells[1]!).text()))
  })

  $('.projector_attributes dt, .parameters dt, .attributes dt').each((_, node) => {
    const name = squash($(node).text())
    const value = squash($(node).next('dd').text())

    push(name, value)
  })

  return attributes.slice(0, 20)
}

// --- verejné API -----------------------------------------------------------

/**
 * Identifikátor produktu odvodený z URL.
 *
 * Shoper: `/pl/p/<názov>/<id>` → `502`. WooCommerce a spol. nemajú číslo, tak
 * sa berie posledný neprázdny segment cesty (slug) — ten je v rámci jedného
 * zdroja tiež jedinečný. Nie je to kľúč idempotencie (tým je `sourceUrl`),
 * len ľudsky čitateľná stopa v admine.
 */
export const externalIdFromUrl = (url: string): string => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''

    return /^\d+$/.test(last) ? last : last.slice(0, 120)
  } catch {
    return ''
  }
}

export const extractProduct = (url: string, html: string): ScrapedProduct => {
  const $ = cheerio.load(html)
  const base = $('link[rel="canonical"]').attr('href')?.trim() || url
  const ld = readLdProduct($)

  const title = squash(
    (typeof (ld as { name?: unknown })?.name === 'string'
      ? String((ld as { name?: unknown }).name)
      : '') ||
      readMicro($, 'name') ||
      readMeta($, 'og:title') ||
      $('h1').first().text() ||
      $('title').text(),
  )

  const descriptionHtml = readDescriptionHtml($, ld)
  const { amount, currency } = readPrice($, ld)

  const skuRaw =
    (typeof (ld as { sku?: unknown })?.sku === 'string' ? String((ld as { sku?: unknown }).sku) : '') ||
    readMicro($, 'sku') ||
    readMicro($, 'mpn') ||
    ''

  const availabilityRaw =
    readMicro($, 'availability') ||
    (asArray((ld as { offers?: unknown })?.offers)[0] as { availability?: unknown } | undefined)
      ?.availability ||
    ''

  return {
    attributes: readAttributes($, ld),
    availability: String(availabilityRaw || '').replace(/^https?:\/\/schema\.org\//i, '') || null,
    categoryPath: readCategoryPath($, title),
    descriptionHtml,
    descriptionText: htmlToParagraphs(descriptionHtml).join('\n'),
    externalId: externalIdFromUrl(url),
    images: readImages($, ld, base),
    priceAmount: amount,
    priceCurrency: currency,
    sku: squash(skuRaw) || null,
    sourceUrl: url,
    title,
  }
}
