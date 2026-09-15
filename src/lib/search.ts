import type { Payload, Where } from 'payload'

import type { Product, SiteSetting } from '@/payload-types'

/**
 * Single source of truth for *how* the storefront searches products.
 *
 * Extracted from `shop/page.tsx` (Z1) so the full results page (`/shop?q=`)
 * and the mobile overlay's live suggestions (`/api/search-suggest`) can never
 * disagree: both resolve the same `SiteSettings.search` config through
 * `resolveSearchConfig`, and both build their `where` through
 * `buildProductSearchClauses`. Framework-agnostic (no 'use client', no Next
 * APIs) — it runs in a Server Component and in a route handler alike.
 */

export type ProductSearchField = 'categories' | 'description' | 'title'

/**
 * The lean, serializable product shape the search overlay renders as a 48px
 * thumbnail row — returned by `/api/search-suggest` and by the server-side
 * "odporúčané produkty" read. Imported `import type`-only by the client
 * component, so none of this module's server imports follow it into the
 * browser bundle.
 */
export type SearchSuggestProduct = {
  id: number
  image: null | { alt: string; url: string }
  priceInEUR: null | number
  slug: string
  title: string
}

/** A recommended category, as a tappable chip in the overlay's empty state. */
export type SearchSuggestCategory = {
  id: number
  title: string
}

export const DEFAULT_MIN_CHARS = 2
export const DEFAULT_RESULTS_PER_PAGE = 12
export const DEFAULT_SEARCH_FIELDS: ProductSearchField[] = ['title', 'description']

/** How many category rows a `categories` search may resolve before matching
 * products against them — the pre-existing cap, kept as-is. */
const CATEGORY_LOOKUP_LIMIT = 50

export type ResolvedSearchConfig = {
  minChars: number
  resultsPerPage: number
  searchFields: ProductSearchField[]
}

/**
 * `SiteSettings.search` → concrete numbers, with the exact fallbacks the shop
 * page used before the global existed (2-character minimum, title+description,
 * 12 per page), so an unsaved or failed read never breaks search.
 */
export function resolveSearchConfig(siteSettings: null | SiteSetting | undefined): ResolvedSearchConfig {
  const searchConfig = siteSettings?.search

  return {
    minChars: searchConfig?.minChars ?? DEFAULT_MIN_CHARS,
    resultsPerPage: searchConfig?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE,
    searchFields:
      searchConfig?.searchFields && searchConfig.searchFields.length > 0
        ? searchConfig.searchFields
        : DEFAULT_SEARCH_FIELDS,
  }
}

/**
 * A `depth: 1` product doc → the lean row shape above. Same image precedence
 * the cart's cross-sell strip uses: first gallery image, else the meta image,
 * else no thumbnail at all.
 */
export function toSearchSuggestProduct(product: Product): SearchSuggestProduct {
  const metaImage =
    product.meta?.image && typeof product.meta.image === 'object' ? product.meta.image : undefined
  const firstGalleryImage =
    product.gallery?.[0]?.image && typeof product.gallery[0].image === 'object'
      ? product.gallery[0].image
      : undefined
  const image = firstGalleryImage || metaImage

  return {
    id: product.id,
    image: image?.url ? { alt: image.alt || product.title, url: image.url } : null,
    priceInEUR: product.priceInEUR ?? null,
    slug: product.slug,
    title: product.title,
  }
}

/**
 * The `or:` arm of a product search — one clause per configured search field.
 *
 * `categories` needs a round-trip: products don't store a category *name* to
 * `like` against, so matching category ids are resolved first (cheap,
 * title-only select) and the products are then matched by relationship.
 * Returns `[]` for an empty term, which callers treat as "no search at all".
 */
export async function buildProductSearchClauses(
  payload: Payload,
  term: string,
  searchFields: ProductSearchField[],
): Promise<Where[]> {
  const clauses: Where[] = []
  if (!term) return clauses

  if (searchFields.includes('title')) {
    clauses.push({ title: { like: term } })
  }
  if (searchFields.includes('description')) {
    clauses.push({ description: { like: term } })
  }
  if (searchFields.includes('categories')) {
    const matchingCategories = await payload.find({
      collection: 'categories',
      limit: CATEGORY_LOOKUP_LIMIT,
      overrideAccess: false,
      select: { title: true },
      where: { title: { like: term } },
    })
    const matchingCategoryIds = matchingCategories.docs.map((doc) => doc.id)
    if (matchingCategoryIds.length > 0) {
      clauses.push({ categories: { in: matchingCategoryIds } })
    }
  }

  return clauses
}
