/**
 * The shape the three feed renderers consume.
 *
 * Built once (and cached) by `src/lib/feeds/build.ts`, then rendered as Google
 * Merchant RSS, Meta XML or Meta CSV. Everything here is already a *string in
 * feed format* — prices carry their currency, dimensions carry their unit —
 * so a renderer only ever escapes and concatenates, never re-formats.
 */

/** One mapped optional attribute, e.g. `{ name: 'g:material', value: 'prútie' }`. */
export type FeedAttribute = {
  /** Element name as it goes into the XML, including the `g:` prefix. */
  name: string
  value: string
}

/** Google availability values; Meta accepts these too (see `metaAvailability`). */
export type FeedAvailability = 'backorder' | 'in_stock' | 'out_of_stock'

export type FeedItem = {
  additionalImageLinks: string[]
  attributes: FeedAttribute[]
  availability: FeedAvailability
  brand: string
  condition: string
  description: string
  googleProductCategory: string
  id: string
  /** Absolute URL of the first gallery image. Never empty — see `build.ts`. */
  imageLink: string
  /**
   * False only when a mapping actually produced a `g:gtin` or `g:mpn` for this
   * product. Google requires the explicit `identifier_exists: no` otherwise.
   */
  identifierExists: boolean
  link: string
  /** Already formatted, e.g. `99.00 EUR`. */
  price: string
  shipping: null | { country: string; price: string }
  title: string
}

export type FeedPayload = {
  /** Mirrors `feed-settings.enabled`; a disabled feed is served as a 404. */
  enabled: boolean
  generatedAt: string
  items: FeedItem[]
  siteUrl: string
  /** Number of otherwise-eligible products dropped for having no price. */
  skippedNoPrice: number
  /** Number of otherwise-eligible products dropped for having no image. */
  skippedNoImage: number
  storeName: string
  /** True when the catalog exceeded the hard page cap and the feed is partial. */
  truncated: boolean
}
