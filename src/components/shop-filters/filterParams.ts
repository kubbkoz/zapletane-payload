import type { Where } from 'payload'

/**
 * Shared URL-param <-> filter-state contract for /shop.
 *
 * Framework-agnostic on purpose (no 'use client', no server-only APIs) so the
 * exact same parsing/serializing logic runs both in the Server Component
 * (`shop/page.tsx`, building the Payload `where` clause) and in client
 * filter widgets (building hrefs / calling `router.push`). Keeping one
 * implementation avoids the URL contract drifting between the two.
 *
 * Every param name is a named export — nothing else in the app should spell
 * these strings out directly.
 */

export const CATEGORY_PARAM = 'category'
export const PRICE_MIN_PARAM = 'priceMin'
export const PRICE_MAX_PARAM = 'priceMax'
export const AVAILABILITY_PARAM = 'availability'
/** Pagination param — a plain page number, 1-based. Reset to the default
 * (removed) by every filter mutator in `useShopFilterUrl`, so changing a
 * facet never strands the visitor on a now out-of-range page. */
export const PAGE_PARAM = 'page'

/**
 * Dynamic tag filters (X4, driven by the `product-filters` collection) don't
 * have a fixed param name — each admin-defined filter gets its own
 * `f_<slug>` param (e.g. `f_material=vlna,prutie`), comma-list-of-option-
 * values shaped exactly like `category`/`availability` above. Parsing scans
 * every incoming key for this prefix rather than requiring the filter
 * config up front, so the same helpers work whether or not the caller knows
 * which filters currently exist.
 */
export const TAG_FILTER_PARAM_PREFIX = 'f_'

export function tagFilterParamName(slug: string): string {
  return `${TAG_FILTER_PARAM_PREFIX}${slug}`
}

/** Combinable stock facets — semantics ported 1:1 from `getStockState` in
 * `@/utilities/stockStatus` (inStock = inventory > 0, onOrder = inventory is
 * null). `soldOut` (inventory === 0) intentionally has no checkbox. */
export const AVAILABILITY_VALUES = ['in_stock', 'on_order'] as const
export type AvailabilityValue = (typeof AVAILABILITY_VALUES)[number]

export const AVAILABILITY_OPTIONS: { value: AvailabilityValue; label: string }[] = [
  { value: 'in_stock', label: 'Skladom' },
  { value: 'on_order', label: 'Na objednávku' },
]

/** A sane upper bound for a hand-typed price — guards against garbage like
 * `?priceMax=99999999999999` reaching the database. */
const MAX_REASONABLE_PRICE_EUR = 100_000

/** The shape Next.js hands a Server Component's `searchParams`, and also
 * what a client component can build from `URLSearchParams` via `getAll()`. */
export type SearchParamsInput = Record<string, string | string[] | undefined>

export type ShopFilters = {
  categoryIds: number[]
  /** Decimal euros (e.g. 19.99), already clamped to >= 0 and swapped so
   * min <= max. `undefined` = no bound on that side. */
  priceMinEUR?: number
  priceMaxEUR?: number
  availability: AvailabilityValue[]
  /** Admin-defined tag filters (X4) — keyed by the filter's `slug`, each
   * value the list of selected option `value`s for that filter. A slug with
   * no selection is simply absent from the map (never an empty array). */
  tags: Record<string, string[]>
}

export const EMPTY_FILTERS: ShopFilters = {
  categoryIds: [],
  availability: [],
  tags: {},
}

/** Accepts both conventions — repeated params (`?category=1&category=2`)
 * and a comma list (`?category=1,2`) — and normalizes to a flat string list.
 * A bare single value (`?category=5`, the pre-existing link shape) round-trips
 * unchanged, which is what keeps old links working. */
export function toList(value: string | string[] | undefined): string[] {
  if (!value) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function parseCategoryIds(value: string | string[] | undefined): number[] {
  const ids = toList(value)
    .map((entry) => Number(entry))
    .filter((n) => Number.isInteger(n) && n > 0)

  return Array.from(new Set(ids))
}

export function parseAvailability(value: string | string[] | undefined): AvailabilityValue[] {
  const known = new Set<string>(AVAILABILITY_VALUES)
  const values = toList(value).filter((entry): entry is AvailabilityValue => known.has(entry))

  return Array.from(new Set(values))
}

/**
 * Scans every key of the incoming params for the `f_<slug>` shape and
 * collects each into a normalized value list — same repeated-param /
 * comma-list tolerance as `toList`. Works without knowing which tag filters
 * currently exist (the filter config only matters for rendering the
 * checkboxes and chip labels, never for parsing the URL), so a stale param
 * from a since-disabled filter parses fine too — `shopFiltersToWhere` simply
 * applies it, `ActiveFilterChips` falls back to the raw value as its label.
 */
export function parseTagFilters(searchParams: SearchParamsInput): Record<string, string[]> {
  const tags: Record<string, string[]> = {}

  for (const key of Object.keys(searchParams)) {
    if (!key.startsWith(TAG_FILTER_PARAM_PREFIX)) continue
    const slug = key.slice(TAG_FILTER_PARAM_PREFIX.length)
    if (!slug) continue

    const values = toList(searchParams[key])
    if (values.length > 0) tags[slug] = Array.from(new Set(values))
  }

  return tags
}

/** Converts a live `URLSearchParams` (what client components read via
 * `useSearchParams()`) into the plain-object shape `parseShopFilters` takes,
 * preserving every key — including any `f_<slug>` ones — as a value list.
 * Lets the client hook parse the *whole* query string generically instead of
 * cherry-picking known param names, which is what lets dynamically-slugged
 * tag filters parse without the hook needing the filter config. */
export function searchParamsToInput(searchParams: URLSearchParams): SearchParamsInput {
  const input: SearchParamsInput = {}
  for (const key of new Set(searchParams.keys())) {
    input[key] = searchParams.getAll(key)
  }
  return input
}

/** Parses one price boundary. Accepts `,` as a decimal separator too (SK
 * keyboards default to it). Returns `undefined` for anything empty, not a
 * number, negative, or absurdly large — i.e. an invalid price is silently
 * ignored rather than breaking the query. */
export function parsePriceBoundary(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined

  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return undefined

  const num = Number(normalized)
  if (!Number.isFinite(num) || num < 0 || num > MAX_REASONABLE_PRICE_EUR) return undefined

  // Clamp to cent precision so it maps cleanly onto the integer-cents field.
  return Math.round(num * 100) / 100
}

/** 1-based page number for /shop's pagination (X4). Anything missing,
 * non-numeric, or out-of-range (`<= 0`) falls back to page 1 rather than
 * breaking the query — same defensive posture as `parsePriceBoundary`. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const num = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isInteger(num) && num > 0 ? num : 1
}

export function parseShopFilters(searchParams: SearchParamsInput): ShopFilters {
  const categoryIds = parseCategoryIds(searchParams[CATEGORY_PARAM])
  const availability = parseAvailability(searchParams[AVAILABILITY_PARAM])
  const tags = parseTagFilters(searchParams)
  let priceMinEUR = parsePriceBoundary(searchParams[PRICE_MIN_PARAM])
  let priceMaxEUR = parsePriceBoundary(searchParams[PRICE_MAX_PARAM])

  // A user (or a hand-edited URL) can put the bounds in backwards — swap
  // rather than return zero results.
  if (priceMinEUR !== undefined && priceMaxEUR !== undefined && priceMinEUR > priceMaxEUR) {
    const swapped = [priceMaxEUR, priceMinEUR] as const
    ;[priceMinEUR, priceMaxEUR] = swapped
  }

  return { categoryIds, priceMinEUR, priceMaxEUR, availability, tags }
}

export function eurosToCents(value: number): number {
  return Math.round(value * 100)
}

/**
 * Builds the extra `where` clauses for the active custom filters. Returns an
 * array meant to be spread into the outer `and: [...]` alongside the
 * existing status/search clauses in `shop/page.tsx` — each entry here is
 * itself already AND-safe (internally OR-ing only its own facet's values).
 */
export function shopFiltersToWhere(filters: ShopFilters): Where[] {
  const clauses: Where[] = []

  if (filters.categoryIds.length > 0) {
    clauses.push({ categories: { in: filters.categoryIds } })
  }

  if (filters.priceMinEUR !== undefined || filters.priceMaxEUR !== undefined) {
    const priceClause: Record<string, number> = {}
    if (filters.priceMinEUR !== undefined) {
      priceClause.greater_than_equal = eurosToCents(filters.priceMinEUR)
    }
    if (filters.priceMaxEUR !== undefined) {
      priceClause.less_than_equal = eurosToCents(filters.priceMaxEUR)
    }
    clauses.push({ priceInEUR: priceClause })
  }

  if (filters.availability.length > 0) {
    const availabilityOr: Where[] = []
    if (filters.availability.includes('in_stock')) {
      availabilityOr.push({ inventory: { greater_than: 0 } })
    }
    if (filters.availability.includes('on_order')) {
      availabilityOr.push({ inventory: { exists: false } })
    }
    clauses.push(availabilityOr.length === 1 ? availabilityOr[0] : { or: availabilityOr })
  }

  // Each tag filter is its own AND-clause (facets narrow the result set
  // together); the option values within one facet OR together via `in`.
  // `filterTags` is an array field (`{ tag: string }[]`) — Payload flattens
  // array subfields for querying, so `filterTags.tag` matches a product when
  // ANY row of its filterTags array has a matching `tag`.
  for (const values of Object.values(filters.tags)) {
    if (values.length > 0) {
      clauses.push({ 'filterTags.tag': { in: values } })
    }
  }

  return clauses
}

export function hasActiveFilters(filters: ShopFilters): boolean {
  return (
    filters.categoryIds.length > 0 ||
    filters.availability.length > 0 ||
    filters.priceMinEUR !== undefined ||
    filters.priceMaxEUR !== undefined ||
    Object.keys(filters.tags).length > 0
  )
}

/** Total count shown on the mobile "Filtre" badge and used to decide whether
 * to render the chips row / "Zrušiť všetky". Each selected category, each
 * selected availability value and each selected tag-filter option counts as
 * one; a price range counts as one chip per bound that's actually set. */
export function countActiveFilters(filters: ShopFilters): number {
  let count = filters.categoryIds.length + filters.availability.length
  if (filters.priceMinEUR !== undefined) count += 1
  if (filters.priceMaxEUR !== undefined) count += 1
  for (const values of Object.values(filters.tags)) count += values.length
  return count
}
