import type { ProductFilter } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

export type CategoryOption = {
  id: number
  title: string
}

/**
 * Category options for the shop filter (checkbox list + chip labels).
 * Shared by `Categories.tsx` (the sidebar/drawer checkbox list) and
 * `shop/page.tsx` (chip labels for the active-filter row) so both read the
 * same cheap, title-sorted query.
 *
 * `ids` restricts the result to that subset — used by the dynamic filter
 * panel (X4) when a `product-filters` doc of type "categories" names its own
 * `categories` relationship. Omitted or empty = every category, the
 * pre-existing behaviour (also what the doc's own admin copy promises:
 * "Prázdne = ponúknu sa všetky kategórie").
 */
export async function getCategoryOptions(ids?: number[]): Promise<CategoryOption[]> {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    sort: 'title',
    limit: 200,
    select: {
      title: true,
    },
    ...(ids && ids.length > 0 ? { where: { id: { in: ids } } } : {}),
  })

  return categories.docs.map((doc) => ({ id: doc.id, title: doc.title }))
}

/**
 * Enabled `product-filters` docs, sorted for the panel (X4) — the *shape* of
 * the /shop filter rail. An empty array means either nothing is configured
 * yet or the read failed; either way the caller's job is to fall back to the
 * hard-coded price/availability/categories panel, so this never throws.
 *
 * Freshness: `product-filters` (`src/collections/ProductFilters.ts`) has no
 * `afterChange` revalidate hook — unlike the globals (see
 * `src/globals/revalidateGlobal.ts`), nothing calls `revalidateTag` for this
 * collection today. Adding one is a schema change and out of scope here
 * (reported as a follow-up — see the handoff report). The `tags` entry below
 * is therefore inert until that hook exists; the 60s `revalidate` ceiling —
 * matching `getCachedGlobal`'s convention — is what actually keeps an admin
 * edit from being invisible for longer than that.
 */
const readShopFilterConfig = unstable_cache(
  async (): Promise<ProductFilter[]> => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'product-filters',
      depth: 0,
      limit: 50,
      overrideAccess: false,
      sort: 'sortOrder',
      where: { enabled: { equals: true } },
    })

    return result.docs
  },
  ['shop-filter-config'],
  { revalidate: 60, tags: ['product-filters'] },
)

export async function getShopFilterConfig(): Promise<ProductFilter[]> {
  try {
    return await readShopFilterConfig()
  } catch (err) {
    // Same posture as `getSiteSettings` — a DB hiccup must fall back to the
    // hard-coded panel, never 500 the whole /shop page.
    console.error('[shop-filters] product-filters read failed, using the built-in panel:', err)
    return []
  }
}

export type PriceBounds = {
  minEUR: number | null
  maxEUR: number | null
}

/**
 * Catalog-wide min/max price, in decimal euros — used only as input
 * placeholders / clamp hints for the "Cena" filter (never fed back into a
 * `where` clause). Two cheap single-field, limit-1 queries rather than one
 * full scan.
 */
export async function getPriceBounds(): Promise<PriceBounds> {
  const payload = await getPayload({ config: configPromise })

  const [lowest, highest] = await Promise.all([
    payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      limit: 1,
      sort: 'priceInEUR',
      where: { priceInEUR: { exists: true } },
      select: { priceInEUR: true },
    }),
    payload.find({
      collection: 'products',
      draft: false,
      overrideAccess: false,
      limit: 1,
      sort: '-priceInEUR',
      where: { priceInEUR: { exists: true } },
      select: { priceInEUR: true },
    }),
  ])

  const minCents = lowest.docs[0]?.priceInEUR
  const maxCents = highest.docs[0]?.priceInEUR

  return {
    minEUR: typeof minCents === 'number' ? minCents / 100 : null,
    maxEUR: typeof maxCents === 'number' ? maxCents / 100 : null,
  }
}
