'use client'

import { Price } from '@/components/Price'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Loader2, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type CrossSellProduct = {
  id: number
  slug: string
  title: string
  priceInEUR: number | null
  inventory: number | null
  image: { url: string; alt: string } | null
}

type Props = {
  /** Distinct product ids currently in the cart. */
  productIds: number[]
}

/**
 * Cart drawer cross-sell strip — „Doplňte k objednávke". Resolves the
 * `crossSell` targets of whatever is currently in the cart via
 * `/api/cross-sell` (server route backed by the Payload local API — targets
 * already in the cart are excluded there), refetching only when the set of
 * cart product ids changes and caching each result for the life of this
 * mount so reopening the drawer on the same basket doesn't refetch.
 *
 * Renders nothing while loading or when there is nothing to suggest, so it
 * never reserves empty space inside the capped-height sheet.
 */
export function CartCrossSell({ productIds }: Props) {
  const { addItem } = useCart()
  const [products, setProducts] = useState<CrossSellProduct[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const cache = useRef<Map<string, CrossSellProduct[]>>(new Map())

  const key = [...productIds].sort((a, b) => a - b).join(',')

  useEffect(() => {
    if (!key) {
      setProducts([])
      return
    }

    const cached = cache.current.get(key)
    if (cached) {
      setProducts(cached)
      return
    }

    let cancelled = false

    fetch(`/api/cross-sell?ids=${key}`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data: { products?: CrossSellProduct[] }) => {
        if (cancelled) return
        const list = data.products || []
        cache.current.set(key, list)
        setProducts(list)
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })

    return () => {
      cancelled = true
    }
  }, [key])

  const handleAdd = (product: CrossSellProduct) => {
    setAddingId(product.id)
    addItem({ product: product.id })
      .then(() => toast.success('Produkt bol pridaný do košíka.'))
      .finally(() => setAddingId(null))
  }

  if (!products.length) return null

  return (
    <div className="border-t border-gray-100 px-6 py-5">
      <p className="font-tech text-[11px] font-bold uppercase tracking-widest text-gray-500">
        Doplňte k objednávke
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {products.map((product) => (
          <li className="flex items-center gap-3" key={product.id}>
            <Link
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-gray-100 bg-gray-50"
              href={`/products/${product.slug}`}
            >
              {product.image?.url && (
                <Image
                  alt={product.image.alt}
                  className="h-full w-full object-contain p-1 mix-blend-multiply"
                  height={48}
                  src={product.image.url}
                  width={48}
                />
              )}
            </Link>

            <div className="flex min-w-0 grow flex-col">
              <Link
                className="line-clamp-1 font-sans text-[12px] font-medium leading-snug text-black transition-colors hover:text-brand"
                href={`/products/${product.slug}`}
              >
                {product.title}
              </Link>
              {typeof product.priceInEUR === 'number' && (
                <Price
                  amount={product.priceInEUR}
                  as="span"
                  className="font-tech text-[12px] font-bold leading-none text-black"
                />
              )}
            </div>

            <button
              aria-label={`Pridať ${product.title} do košíka`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-default border border-gray-200 text-black transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              disabled={addingId === product.id || product.inventory === 0}
              onClick={() => handleAdd(product)}
              type="button"
            >
              {addingId === product.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
