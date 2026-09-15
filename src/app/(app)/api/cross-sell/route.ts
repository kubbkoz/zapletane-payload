import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const MAX_SUGGESTIONS = 3

type CrossSellProduct = {
  id: number
  slug: string
  title: string
  priceInEUR: number | null
  inventory: number | null
  image: { url: string; alt: string } | null
}

/**
 * GET /api/cross-sell?ids=1,2,3
 *
 * Backs the cart drawer's „Doplňte k objednávke" strip (CartCrossSell). Cart
 * items only carry product ids client-side, so this resolves the `crossSell`
 * targets of the products currently in the cart (given as `ids`), excludes
 * anything already in the cart, and returns up to MAX_SUGGESTIONS compact
 * product summaries — just enough for a 48px thumbnail row.
 *
 * Two local-API reads: one cheap depth:0 pass to collect the crossSell id
 * lists off the cart's own products, then one depth:1 pass (capped to
 * MAX_SUGGESTIONS) to resolve the target docs' images. Respects the
 * `products` collection's own read access (no overrideAccess), same as any
 * other storefront read.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const rawIds = searchParams.get('ids') || ''

  const cartProductIds = Array.from(
    new Set(
      rawIds
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  )

  if (!cartProductIds.length) {
    return Response.json({ products: [] })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    const cartProducts = await payload.find({
      collection: 'products',
      depth: 0,
      limit: cartProductIds.length,
      pagination: false,
      where: { id: { in: cartProductIds } },
    })

    const crossSellIds = Array.from(
      new Set(
        cartProducts.docs.flatMap((product) =>
          (product.crossSell || []).map((entry) => (typeof entry === 'object' ? entry.id : entry)),
        ),
      ),
    ).filter((id): id is number => typeof id === 'number' && !cartProductIds.includes(id))

    if (!crossSellIds.length) {
      return Response.json({ products: [] })
    }

    const targets = await payload.find({
      collection: 'products',
      depth: 1,
      limit: MAX_SUGGESTIONS,
      pagination: false,
      where: { id: { in: crossSellIds } },
    })

    const products: CrossSellProduct[] = targets.docs.map((product) => {
      const metaImage =
        product.meta?.image && typeof product.meta.image === 'object'
          ? product.meta.image
          : undefined
      const firstGalleryImage =
        product.gallery?.[0]?.image && typeof product.gallery[0].image === 'object'
          ? product.gallery[0].image
          : undefined
      const image = firstGalleryImage || metaImage

      return {
        id: product.id,
        image: image?.url ? { alt: image.alt || product.title, url: image.url } : null,
        inventory: product.inventory ?? null,
        priceInEUR: product.priceInEUR ?? null,
        slug: product.slug,
        title: product.title,
      }
    })

    return Response.json({ products })
  } catch (error) {
    console.error('[cross-sell] failed to resolve suggestions:', error)
    return Response.json({ products: [] }, { status: 500 })
  }
}
