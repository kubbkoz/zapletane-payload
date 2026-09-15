'use client'

import type { Product } from '@/payload-types'

import { Heart } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ProductGridItem } from '@/components/ProductGridItem'
import { useWishlist } from '@/wishlist/WishlistProvider'

/** The exact field set `ProductGridItem` reads — nothing more travels. */
const SELECT = ['title', 'slug', 'gallery', 'priceInEUR', 'inventory', 'enableVariants'] as const

/**
 * Saved products, resolved client-side.
 *
 * The page itself is server-guarded (a guest never gets here — it redirects to
 * `/login`), but the list stays client-rendered so that un-hearting a card
 * updates this grid instantly instead of waiting for a round trip. The ids come
 * from `WishlistProvider`, i.e. from the signed-in user's own document.
 *
 * Products the shop has since unpublished or deleted simply do not come back
 * and the page renders the remainder rather than an error — the saved ids are
 * left alone, so republishing a product brings it straight back.
 */
export function WishlistGrid() {
  const wishlist = useWishlist()
  const ids = wishlist?.ids
  const isReady = wishlist?.isReady ?? false

  const [products, setProducts] = useState<Partial<Product>[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Stable key so a re-render with the same ids never re-fires the request.
  const key = useMemo(() => (ids ? [...ids].sort((a, b) => a - b).join(',') : ''), [ids])
  const lastKey = useRef<null | string>(null)

  useEffect(() => {
    if (!isReady) return
    if (lastKey.current === key) return
    lastKey.current = key

    if (!key) {
      setProducts([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    const params = new URLSearchParams()
    params.set('depth', '1')
    params.set('limit', '100')
    params.set('where[id][in]', key)
    params.set('where[_status][equals]', 'published')
    for (const field of SELECT) params.set(`select[${field}]`, 'true')

    // Relative, same-origin — see the note in WishlistProvider.
    fetch(`/api/products?${params.toString()}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { docs: [] }))
      .then((json: { docs?: Partial<Product>[] }) => {
        setProducts(Array.isArray(json?.docs) ? json.docs : [])
      })
      .catch(() => {
        /* aborted or offline — keep whatever is already on screen */
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [isReady, key])

  // Keep the shopper's own order (oldest save first), not the API's.
  const ordered = useMemo(() => {
    if (!ids?.length) return []
    const byID = new Map(products.map((product) => [product.id, product]))
    return ids
      .map((id) => byID.get(id))
      .filter((product): product is Partial<Product> => Boolean(product))
  }, [ids, products])

  if (!isReady || (isLoading && ordered.length === 0)) {
    return (
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            className="h-[420px] animate-pulse rounded-default border border-gray-100 bg-white"
            key={index}
          />
        ))}
      </div>
    )
  }

  if (ordered.length === 0) {
    return (
      <div className="card-editorial mt-12 flex flex-col items-center px-8 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
          <Heart className="size-7" strokeWidth={1.5} />
        </span>
        <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
          Zatiaľ tu nič nemáte
        </h2>
        <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
          Ukladajte si obľúbené kúsky srdiečkom — nájdete ich tu vždy pokope.
        </p>
        <Link className="btn-primary group mt-8" href="/shop">
          Prejsť do obchodu
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {ordered.map((product) => (
        <ProductGridItem key={product.id} product={product} />
      ))}
    </div>
  )
}
