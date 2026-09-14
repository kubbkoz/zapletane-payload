import configPromise from '@payload-config'
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
 */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    sort: 'title',
    limit: 200,
    select: {
      title: true,
    },
  })

  return categories.docs.map((doc) => ({ id: doc.id, title: doc.title }))
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
