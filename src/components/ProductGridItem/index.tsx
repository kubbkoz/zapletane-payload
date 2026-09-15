import type { Media as MediaType, Product, Variant } from '@/payload-types'

import Link from 'next/link'
import React from 'react'
import { ArrowRight } from 'lucide-react'

import { Price } from '@/components/Price'
import { CardAddToCartButton, CardWishlistButton } from './CardActions'
import { cardActionClass } from './cardActionClass'
import { CardMedia } from './CardMedia'
import { cn } from '@/utilities/cn'
import { getStockState, stockBadgeClass, stockDotClass, stockLabel } from '@/utilities/stockStatus'

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
  const { gallery, inventory, priceInEUR, title } = product

  let price = priceInEUR

  const variants = product.variants?.docs
  const hasVariants = Boolean(product.enableVariants && variants && variants.length > 0)

  // The CTA's question is different from the stock pill's. Listing queries
  // `select` a narrow field set and never load the `variants` join, so
  // `hasVariants` above is false on a listing even for a product that *does*
  // have variants — good enough for "should the simple-product stock pill
  // show", fatal for "may this card add straight to the cart". A variable
  // product must be configured on its detail page first, so the flag alone
  // decides the CTA.
  const isVariableProduct = Boolean(product.enableVariants)

  if (variants && variants.length > 0) {
    const variant = variants[0]
    if (
      variant &&
      typeof variant === 'object' &&
      variant?.priceInEUR &&
      typeof variant.priceInEUR === 'number'
    ) {
      price = variant.priceInEUR
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
        {/* Z10 — the heart is pinned to the image zone, so the slider keeps its
            own `relative` box and this wrapper owns the overlay coordinates. */}
        <div className="relative">
          <CardMedia images={images} title={title || ''} />
          {typeof product.id === 'number' ? (
            <CardWishlistButton productID={product.id} title={title || undefined} />
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-2 md:p-4">
          <h3 className="mb-1.5 line-clamp-2 h-[2.5em] font-sans text-[13px] font-medium leading-tight text-gray-900 transition-colors duration-200 group-hover:text-brand md:text-sm">
            {title}
          </h3>

          {!hasVariants && (
            <div className="mb-5 flex flex-wrap gap-1.5">
              <div
                className={cn(
                  'inline-flex h-6 items-center gap-1.5 rounded-sm px-2.5',
                  stockBadgeClass[stockState],
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', stockDotClass[stockState])} />
                <span className="whitespace-nowrap font-sans text-[11px] font-semibold leading-none">
                  {stockLabel[stockState]}
                </span>
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

            {/* Z10 card CTA. A variable product cannot be added blind — it
                needs a size/colour picked first — so it keeps an arrow that
                rides the card's own link to the detail page. It is a <span>,
                not a second <Link>: the whole card already links to exactly
                this href, and nesting an <a> inside an <a> is invalid markup.
                A simple product gets the real add-to-cart button. Same chip,
                same brown, same size either way. */}
            {isVariableProduct || typeof product.id !== 'number' ? (
              <span aria-hidden="true" className={cardActionClass}>
                <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
              </span>
            ) : (
              <CardAddToCartButton
                inventory={inventory}
                productID={product.id}
                title={title || undefined}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
