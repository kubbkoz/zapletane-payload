import type { SearchSuggestProduct } from '@/lib/search'

import { buildProductSearchClauses, resolveSearchConfig, toSearchSuggestProduct } from '@/lib/search'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/** Never more than this many rows in the overlay's live list, whatever the
 * `resultsPerPage` setting says — the dropdown is a preview, not a page. */
const MAX_SUGGESTIONS = 6

/**
 * GET /api/search-suggest?q=<term>
 *
 * Backs the live results under the mobile search overlay's input. Returns a
 * lean JSON array of at most `min(6, SiteSettings.search.resultsPerPage)`
 * published products — id, title, slug, price and a 48px-thumbnail-sized
 * image reference — and nothing else.
 *
 * The match itself is NOT reimplemented here: `resolveSearchConfig` +
 * `buildProductSearchClauses` are the very helpers `/shop?q=` uses, so a
 * suggestion is by construction one of the full results page's rows (same
 * `searchFields`, same `minChars`, same `like` semantics, same
 * `_status: published` + `overrideAccess: false` read).
 *
 * A term shorter than `minChars` — or any failure — answers `[]`, so the
 * overlay simply shows nothing rather than an error state.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const term = (searchParams.get('q') || '').trim()

  try {
    const siteSettings = await getSiteSettings()
    const { minChars, resultsPerPage, searchFields } = resolveSearchConfig(siteSettings)

    if (term.length < minChars) {
      return Response.json([])
    }

    const payload = await getPayload({ config: configPromise })
    const searchOrClauses = await buildProductSearchClauses(payload, term, searchFields)

    if (searchOrClauses.length === 0) {
      return Response.json([])
    }

    const results = await payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      limit: Math.max(1, Math.min(MAX_SUGGESTIONS, resultsPerPage)),
      overrideAccess: false,
      pagination: false,
      sort: 'title',
      where: {
        and: [{ _status: { equals: 'published' } }, { or: searchOrClauses }],
      },
    })

    const products: SearchSuggestProduct[] = results.docs.map(toSearchSuggestProduct)

    return Response.json(products)
  } catch (error) {
    console.error('[search-suggest] failed to resolve suggestions:', error)
    return Response.json([], { status: 500 })
  }
}
