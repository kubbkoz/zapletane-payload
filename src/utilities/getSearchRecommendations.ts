import type { SearchSuggestCategory, SearchSuggestProduct } from '@/lib/search'
import type { SiteSetting } from '@/payload-types'

import { SITE_SETTINGS_TAG } from '@/globals/SiteSettings'
import { toSearchSuggestProduct } from '@/lib/search'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

export type SearchRecommendations = {
  categories: SearchSuggestCategory[]
  products: SearchSuggestProduct[]
}

const EMPTY: SearchRecommendations = { categories: [], products: [] }

/** Hard ceilings — the overlay's empty state is a shortcut list, not a listing. */
const MAX_PRODUCTS = 4
const MAX_CATEGORIES = 8

/** `getSiteSettings` reads at depth 0, so a relationship arrives as a bare id
 * list; this still tolerates populated docs in case a caller passes a deeper
 * read. */
function toIds(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) =>
      typeof entry === 'number'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'number'
          ? ((entry as { id: number }).id)
          : null,
    )
    .filter((id): id is number => typeof id === 'number')
    .slice(0, max)
}

/**
 * Resolves `SiteSettings.search.recommendedProducts` / `recommendedCategories`
 * into the lean shapes the (client) search overlay renders — the same product
 * row shape `/api/search-suggest` returns, so both lists look identical.
 *
 * Costs nothing when nothing is configured (the common case): no ids, no
 * query. When something *is* configured the two reads are cached for a minute
 * and tagged with the site-settings tag, so an editor's save shows up on the
 * next request instead of waiting the minute out. Published-only, access rules
 * respected — exactly like the shop listing's own read.
 *
 * The admin's ordering is preserved (Payload's `in` does not guarantee it).
 */
export async function getSearchRecommendations(
  siteSettings: null | SiteSetting | undefined,
): Promise<SearchRecommendations> {
  const productIds = toIds(siteSettings?.search?.recommendedProducts, MAX_PRODUCTS)
  const categoryIds = toIds(siteSettings?.search?.recommendedCategories, MAX_CATEGORIES)

  if (!productIds.length && !categoryIds.length) return EMPTY

  try {
    return await readRecommendations(productIds, categoryIds)
  } catch (error) {
    console.error('[search-recommendations] read failed, hiding the sections:', error)
    return EMPTY
  }
}

const readRecommendations = unstable_cache(
  async (productIds: number[], categoryIds: number[]): Promise<SearchRecommendations> => {
    const payload = await getPayload({ config: configPromise })

    const [productResult, categoryResult] = await Promise.all([
      productIds.length
        ? payload.find({
            collection: 'products',
            depth: 1,
            draft: false,
            limit: productIds.length,
            overrideAccess: false,
            pagination: false,
            where: {
              and: [{ _status: { equals: 'published' } }, { id: { in: productIds } }],
            },
          })
        : null,
      categoryIds.length
        ? payload.find({
            collection: 'categories',
            depth: 0,
            limit: categoryIds.length,
            overrideAccess: false,
            pagination: false,
            select: { title: true },
            where: { id: { in: categoryIds } },
          })
        : null,
    ])

    const products = productIds
      .map((id) => productResult?.docs.find((doc) => doc.id === id))
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
      .map(toSearchSuggestProduct)

    const categories = categoryIds
      .map((id) => categoryResult?.docs.find((doc) => doc.id === id))
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
      .map((doc) => ({ id: doc.id, title: doc.title ?? '' }))
      .filter((category) => category.title.length > 0)

    return { categories, products }
  },
  ['search-recommendations'],
  { revalidate: 60, tags: [SITE_SETTINGS_TAG] },
)
