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
}

export const EMPTY_FILTERS: ShopFilters = {
  categoryIds: [],
  availability: [],
}

/** Accepts both conventions — repeated params (`?category=1&category=2`)
 * and a comma list (`?category=1,2`) — and normalizes to a flat string list.
 * A bare single value (`?category=5`, the pre-existing link shape) round-trips
 * unchanged, which is what keeps old links working. */
function toList(value: string | string[] | undefined): string[] {
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

export function parseShopFilters(searchParams: SearchParamsInput): ShopFilters {
  const categoryIds = parseCategoryIds(searchParams[CATEGORY_PARAM])
  const availability = parseAvailability(searchParams[AVAILABILITY_PARAM])
  let priceMinEUR = parsePriceBoundary(searchParams[PRICE_MIN_PARAM])
  let priceMaxEUR = parsePriceBoundary(searchParams[PRICE_MAX_PARAM])

  // A user (or a hand-edited URL) can put the bounds in backwards — swap
  // rather than return zero results.
  if (priceMinEUR !== undefined && priceMaxEUR !== undefined && priceMinEUR > priceMaxEUR) {
    const swapped = [priceMaxEUR, priceMinEUR] as const
    ;[priceMinEUR, priceMaxEUR] = swapped
  }

  return { categoryIds, priceMinEUR, priceMaxEUR, availability }
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

  return clauses
}

export function hasActiveFilters(filters: ShopFilters): boolean {
  return (
    filters.categoryIds.length > 0 ||
    filters.availability.length > 0 ||
    filters.priceMinEUR !== undefined ||
    filters.priceMaxEUR !== undefined
  )
}

/** Total count shown on the mobile "Filtre" badge and used to decide whether
 * to render the chips row / "Zrušiť všetky". Each selected category and each
 * selected availability value counts as one; a price range counts as one
 * chip per bound that's actually set. */
export function countActiveFilters(filters: ShopFilters): number {
  let count = filters.categoryIds.length + filters.availability.length
  if (filters.priceMinEUR !== undefined) count += 1
  if (filters.priceMaxEUR !== undefined) count += 1
  return count
}
