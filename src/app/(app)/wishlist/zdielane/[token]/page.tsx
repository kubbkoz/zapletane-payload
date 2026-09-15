import type { Metadata } from 'next'
import type { Product } from '@/payload-types'

import configPromise from '@payload-config'
import { Heart } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { ProductGridItem } from '@/components/ProductGridItem'

type Props = {
  params: Promise<{ token: string }>
}

/**
 * `/wishlist/zdielane/<token>` — a wishlist someone shared (Z10).
 *
 * The token is a **capability URL**: holding the link is the whole
 * authorisation, which is exactly what "share my list" means. Two consequences
 * are baked in here on purpose:
 *
 *   1. The user lookup runs with `overrideAccess: true` (an anonymous visitor
 *      cannot read a user row) but `select`s **only** `wishlist`. No name, no
 *      e-mail, no roles, nothing else — a leaked link leaks a list of products
 *      and not an identity. The page never renders who the owner is.
 *   2. The products are re-queried through normal access with
 *      `_status: published`, so an unpublished or deleted product simply is not
 *      in the list; sharing can never expose a draft.
 *
 * `noindex, nofollow`: a shared link must not end up in a search index.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Zdieľaný zoznam obľúbených',
}

/** Same field set the storefront listings use for a card. */
const CARD_SELECT = {
  title: true,
  slug: true,
  gallery: true,
  priceInEUR: true,
  inventory: true,
  enableVariants: true,
} as const

export default async function SharedWishlistPage({ params }: Props) {
  const { token } = await params

  if (!token || token.length > 128) notFound()

  const payload = await getPayload({ config: configPromise })

  const owners = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    select: { wishlist: true },
    where: { wishlistShareToken: { equals: token } },
  })

  const owner = owners.docs[0]

  if (!owner) notFound()

  const ids = (Array.isArray(owner.wishlist) ? owner.wishlist : [])
    .map((entry) => (typeof entry === 'object' && entry ? entry.id : entry))
    .filter((id): id is number => typeof id === 'number')

  let products: Partial<Product>[] = []

  if (ids.length > 0) {
    const results = await payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      limit: 100,
      overrideAccess: false,
      select: CARD_SELECT,
      where: {
        and: [{ id: { in: ids } }, { _status: { equals: 'published' } }],
      },
    })

    // Preserve the owner's own order rather than the query's.
    const byID = new Map<number, Partial<Product>>(
      results.docs.map((product) => [product.id, product as Partial<Product>]),
    )
    products = ids
      .map((id) => byID.get(id))
      .filter((product): product is Partial<Product> => Boolean(product))
  }

  return (
    <div className="bg-brand-50">
      <div className="container-editorial py-12 lg:py-16">
        <p className="eyebrow">Zdieľané</p>
        <h1 className="section-h2 mt-4">Zdieľaný zoznam obľúbených</h1>
        <div className="section-decorator mt-6" />
        <p className="mt-6 max-w-[560px] text-[15px] leading-[1.75] text-gray-700">
          Takto vyzerá zoznam, ktorý s vami niekto zdieľal. Kúsky si môžete rovno pridať do košíka.
        </p>

        {products.length === 0 ? (
          <div className="card-editorial mt-12 flex flex-col items-center px-8 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
              <Heart className="size-7" strokeWidth={1.5} />
            </span>
            <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
              Tento zoznam je prázdny
            </h2>
            <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
              Zatiaľ v ňom nie je žiadny dostupný produkt.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductGridItem key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
