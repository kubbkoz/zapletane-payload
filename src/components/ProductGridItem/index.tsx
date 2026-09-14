import type { Media as MediaType, Product, Variant } from '@/payload-types'

import Link from 'next/link'
import React from 'react'
import { ArrowRight } from 'lucide-react'

import { Price } from '@/components/Price'
import { CardMedia } from './CardMedia'
import { cn } from '@/utilities/cn'
import { getStockState, stockChipClass, stockLabel } from '@/utilities/stockStatus'

import '@/components/product/stock-pulse.css'

type Props = {
  product: Partial<Product>
}

/**
 * ZAPLETANE product card — the single card used by every listing, carousel and
 * homepage section (design.md §22 makes that a hard rule). Anatomy ported 1:1
 * from `frontend/product/ProductCard.vue`:
 *
 *   <a> (group, hover lifts with shadow-card-hover)
 *     └ card body (border-gray-100 → border-black on hover, rounded-default)
 *        ├ image zone — aspect-[3/4], gray backdrop, mix-blend-multiply slider
 *        └ info zone  — title (2-line clamp, fixed height) → excerpt →
 *                       stock pill → price row + action button
 */
export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { gallery, inventory, priceInUSD, title } = product

  let price = priceInUSD

  const variants = product.variants?.docs
  const hasVariants = Boolean(product.enableVariants && variants && variants.length > 0)

  if (variants && variants.length > 0) {
    const variant = variants[0]
    if (
      variant &&
      typeof variant === 'object' &&
      variant?.priceInUSD &&
      typeof variant.priceInUSD === 'number'
    ) {
      price = variant.priceInUSD
    }
  }

  const images = (gallery || [])
    .map((item) => item?.image)
    .filter((image): image is MediaType => Boolean(image) && typeof image === 'object')

  // Variant products carry per-variant stock, which the listing query does not
  // load — the original card hides the simple-product stock pill in that case
  // too (it renders variant chips above the title instead).
  const stockState = getStockState(inventory)

  return (
    <Link
      aria-label={`Detail produktu ${title}`}
      className="group relative z-10 flex h-full w-full flex-col bg-white transition-[box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:z-20 hover:shadow-card-hover"
      href={`/products/${product.slug}`}
    >
      <div className="flex flex-1 flex-col overflow-hidden rounded-default border border-gray-100 bg-white transition-colors duration-200 ease-in-out group-hover:border-black">
        <CardMedia images={images} title={title || ''} />

        <div className="flex flex-1 flex-col p-2 md:p-4">
          <h3 className="mb-1.5 line-clamp-2 h-[2.5em] font-sans text-[13px] font-medium leading-tight text-gray-900 transition-colors duration-200 group-hover:text-brand md:text-sm">
            {title}
          </h3>

          {!hasVariants && (
            <div className="mb-5 flex flex-wrap gap-1.5">
              <div
                className={cn(
                  'relative flex h-7 min-w-[38px] items-center justify-center rounded-sm border px-2 text-center font-tech',
                  stockChipClass[stockState],
                )}
              >
                <span className="whitespace-nowrap text-[11px] font-bold uppercase leading-none tracking-tight text-black">
                  {stockLabel[stockState]}
                </span>
                {stockState === 'soldOut' && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <svg className="h-full w-full" preserveAspectRatio="none">
                      <line x1="0" y1="100%" x2="100%" y2="0" stroke="#E4D2CB" strokeWidth="1" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              {typeof price === 'number' && (
                <Price
                  amount={price}
                  as="span"
                  className="font-tech text-lg font-bold leading-none text-black md:text-xl"
                />
              )}
            </div>

            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-default bg-gray-100 text-black transition-colors group-hover:bg-gray-200 md:h-10 md:w-auto md:gap-1.5 md:whitespace-nowrap md:px-3 md:font-tech md:text-[11px] md:font-bold md:uppercase md:tracking-widest">
              <span className="hidden md:inline">Zobraziť produkt</span>
              <ArrowRight className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
