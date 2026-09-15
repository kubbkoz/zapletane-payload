import type { Media, Product, Variant } from '@/payload-types'

import { getStockState } from '@/utilities/stockStatus'

import { descriptionToPlaintext } from './generate'

/**
 * Štruktúrované dáta (schema.org / JSON-LD) pre SEO aj GEO.
 *
 * GEO = generative engine optimization: odpovede v ChatGPT, Perplexity či AI
 * prehľadoch Googlu sa skladajú z toho, čo vie stroj z HTML spoľahlivo vyčítať.
 * Voľný text je dohad, JSON-LD je tvrdý fakt — preto sem ide všetko, čo o
 * produkte vieme: cena, dostupnosť, materiál, rozmery, hmotnosť aj drobček.
 *
 * Zdroje sú zámerne tie isté, aké používajú produktové feedy
 * (`getStockState`, `convertLexicalToPlaintext`), aby sa PDP a feed nikdy
 * nerozišli v tom, čo o produkte tvrdia.
 */

const BRAND = (process.env.SITE_NAME || 'ZAPLETANE').trim() || 'ZAPLETANE'

/** schema.org strop pre popis; feedy používajú ten istý. */
const MAX_JSONLD_DESCRIPTION = 5000

type JsonLdValue = unknown

/**
 * Bezpečná serializácia do `<script type="application/ld+json">`.
 *
 * `</script>` vo vnútri reťazca by inak ukončilo blok a zvyšok by prehliadač
 * považoval za HTML — escapnutie `<` na `<` je v JSON-e legálne a JSON-LD
 * parsery ho prečítajú rovnako.
 */
export const serializeJsonLd = (data: JsonLdValue): string =>
  JSON.stringify(data).replace(/</g, '\\u003c')

const absoluteUrl = (url: string, siteUrl: string): string =>
  /^https?:\/\//i.test(url) ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`

/** Všetky obrázky galérie (plus meta obrázok) ako absolútne URL, bez duplicít. */
export const productImages = (product: Product, siteUrl: string): string[] => {
  const urls: string[] = []
  const push = (media: unknown) => {
    if (!media || typeof media !== 'object') return

    const url = (media as Media).url

    if (!url) return

    const absolute = absoluteUrl(url, siteUrl)

    if (!urls.includes(absolute)) urls.push(absolute)
  }

  for (const entry of product.gallery ?? []) push(entry?.image)

  push(product.meta?.image)

  return urls
}

const AVAILABILITY_URL = {
  inStock: 'https://schema.org/InStock',
  onOrder: 'https://schema.org/BackOrder',
  soldOut: 'https://schema.org/OutOfStock',
} as const

/** Načítané varianty (PDP číta `depth: 3`, takže sú to celé dokumenty). */
const variantDocs = (product: Product): Variant[] =>
  (product.variants?.docs ?? []).filter(
    (variant): variant is Variant => Boolean(variant) && typeof variant === 'object',
  )

/**
 * Rovnaké tri stavy ako na karte a v košíku, preložené do slovníka schema.org.
 * Pri variantnom produkte rozhoduje najlepší stav spomedzi variantov — presne
 * tak, ako to vidí zákazník v selectore.
 */
const availabilityUrl = (product: Product): string => {
  const variants = product.enableVariants ? variantDocs(product) : []

  if (variants.length) {
    const states = variants.map((variant) => getStockState(variant.inventory))

    if (states.includes('inStock')) return AVAILABILITY_URL.inStock
    if (states.includes('onOrder')) return AVAILABILITY_URL.onOrder

    return AVAILABILITY_URL.soldOut
  }

  return AVAILABILITY_URL[getStockState(product.inventory)]
}

/** Cena v eurocentoch, ktorú má ponuka uvádzať — pri variantoch tá najnižšia. */
const offerAmount = (product: Product): null | number => {
  const variants = product.enableVariants ? variantDocs(product) : []

  const prices = variants
    .map((variant) => variant.priceInEUR)
    .filter((price): price is number => typeof price === 'number' && price > 0)

  if (prices.length) return Math.min(...prices)

  return product.priceInEUR ?? null
}

const quantitativeValue = (value: unknown, unitCode: string, unitText: string) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { '@type': 'QuantitativeValue', unitCode, unitText, value }
    : null

/** Cena pre `Offer`: desatinné číslo s bodkou, mena zvlášť. */
const offerPrice = (price?: null | number): null | string =>
  typeof price === 'number' && Number.isFinite(price) && price > 0
    ? (price / 100).toFixed(2)
    : null

/** Platnosť ceny — bez nej Google hlási „missing field priceValidUntil". */
const priceValidUntil = (): string => {
  const date = new Date()

  date.setFullYear(date.getFullYear() + 1)

  return date.toISOString().slice(0, 10)
}

export const buildProductJsonLd = (product: Product, siteUrl: string): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')
  const url = `${base}/products/${product.slug}`
  const images = productImages(product, base)

  const description = (
    descriptionToPlaintext(product.description) ||
    product.meta?.description?.trim() ||
    product.title
  ).slice(0, MAX_JSONLD_DESCRIPTION)

  // Vlastnosti produktu (materiál, hrúbka priadze…) — presne to, čo generatívne
  // vyhľadávače potrebujú, aby vedeli odpovedať na „z čoho to je".
  const additionalProperty = (product.properties ?? [])
    .map((entry) => {
      const value = entry?.value?.trim()
      const property = entry?.property

      if (!value || !property || typeof property !== 'object') return null

      const name = property.name?.trim()

      if (!name) return null

      const unitText = property.unit?.trim()

      return {
        '@type': 'PropertyValue',
        name,
        value,
        ...(unitText ? { unitText } : {}),
      } as Record<string, unknown>
    })
    .filter((entry): entry is Record<string, unknown> => entry !== null)

  const price = offerPrice(offerAmount(product))

  const width = quantitativeValue(product.dimensions?.width, 'CMT', 'cm')
  const height = quantitativeValue(product.dimensions?.height, 'CMT', 'cm')
  const depth = quantitativeValue(product.dimensions?.depth, 'CMT', 'cm')
  const weight = quantitativeValue(product.dimensions?.weight, 'GRM', 'g')

  const categories = (product.categories ?? [])
    .map((category) => (typeof category === 'object' ? category?.title : null))
    .filter((title): title is string => Boolean(title))

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    brand: { '@type': 'Brand', name: BRAND },
    description,
    ...(images.length ? { image: images } : {}),
    productID: String(product.id),
    sku: product.slug || String(product.id),
    url,
    ...(categories.length ? { category: categories.join(' > ') } : {}),
    ...(additionalProperty.length ? { additionalProperty } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(depth ? { depth } : {}),
    ...(weight ? { weight } : {}),
    ...(price
      ? {
          offers: {
            '@type': 'Offer',
            availability: availabilityUrl(product),
            itemCondition: 'https://schema.org/NewCondition',
            price,
            priceCurrency: 'EUR',
            priceValidUntil: priceValidUntil(),
            seller: { '@type': 'Organization', name: BRAND },
            url,
          },
        }
      : {}),
  }
}

/** Drobček zo zoznamu `[názov, absolútna adresa]`. */
const breadcrumbList = (items: { name: string; url: string }[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    item: item.url,
    name: item.name,
    position: index + 1,
  })),
})

/** Domov → Obchod → produkt. */
export const buildBreadcrumbJsonLd = (
  product: Pick<Product, 'slug' | 'title'>,
  siteUrl: string,
): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')

  return breadcrumbList([
    { name: 'Domov', url: `${base}/` },
    { name: 'Obchod', url: `${base}/shop` },
    { name: product.title, url: `${base}/products/${product.slug}` },
  ])
}

/** Domov → Obchod → kategória (pre `/kategoria/<slug>`, Z7). */
export const buildCategoryBreadcrumbJsonLd = (
  category: { slug?: null | string; title: string },
  siteUrl: string,
): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')

  return breadcrumbList([
    { name: 'Domov', url: `${base}/` },
    { name: 'Obchod', url: `${base}/shop` },
    { name: category.title, url: `${base}/kategoria/${category.slug ?? ''}` },
  ])
}

/** Domov → Blog → článok (pre `/blog/<slug>`, Z7). */
export const buildPostBreadcrumbJsonLd = (
  post: { slug?: null | string; title: string },
  siteUrl: string,
): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')

  return breadcrumbList([
    { name: 'Domov', url: `${base}/` },
    { name: 'Blog', url: `${base}/blog` },
    { name: post.title, url: `${base}/blog/${post.slug ?? ''}` },
  ])
}

/**
 * `Article` pre článok blogu (Z7).
 *
 * Rovnaká úvaha ako pri produkte: čo je v JSON-LD, to si vyhľadávač aj
 * generatívny model prečíta ako fakt — nadpis, dátum vydania a poslednej
 * úpravy, obrázok, autor a vydavateľ. Autorom aj vydavateľom je značka, nie
 * osoba: články píše dielňa, nie redakcia s menami.
 */
export const buildArticleJsonLd = (
  post: {
    excerpt?: null | string
    images?: string[]
    meta?: { description?: null | string } | null
    publishedAt?: null | string
    slug?: null | string
    title: string
    updatedAt?: null | string
  },
  siteUrl: string,
): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')
  const url = `${base}/blog/${post.slug ?? ''}`

  const description = (post.excerpt?.trim() || post.meta?.description?.trim() || post.title).slice(
    0,
    MAX_JSONLD_DESCRIPTION,
  )

  const images = (post.images ?? []).map((image) => absoluteUrl(image, base))

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    author: { '@type': 'Organization', name: BRAND, url: `${base}/` },
    description,
    headline: post.title,
    ...(images.length ? { image: images } : {}),
    inLanguage: 'sk-SK',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    publisher: { '@type': 'Organization', name: BRAND, url: `${base}/` },
    url,
  }
}

/** Domov → Obchod (pre výpis obchodu). */
export const buildShopBreadcrumbJsonLd = (siteUrl: string): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')

  return breadcrumbList([
    { name: 'Domov', url: `${base}/` },
    { name: 'Obchod', url: `${base}/shop` },
  ])
}

/**
 * `WebSite` + `SearchAction` — povie vyhľadávačom, že obchod má vlastné
 * vyhľadávanie, a dáva im tvar URL, ktorý môžu ponúknuť priamo vo výsledkoch.
 */
export const buildWebsiteJsonLd = (siteUrl: string): Record<string, unknown> => {
  const base = siteUrl.replace(/\/$/, '')

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    inLanguage: 'sk-SK',
    potentialAction: {
      '@type': 'SearchAction',
      'query-input': 'required name=search_term_string',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/shop?q={search_term_string}`,
      },
    },
    url: `${base}/`,
  }
}
