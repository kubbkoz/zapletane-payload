'use client'

import { Price } from '@/components/Price'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { ArrowRight, ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { DeleteItemButton } from './DeleteItemButton'
import { EditItemQuantityButton } from './EditItemQuantityButton'
import { OpenCartButton } from './OpenCart'
import { Product, Variant } from '@/payload-types'

type GalleryItem = NonNullable<Product['gallery']>[number]
type VariantOptionRef = Variant['options'][number]

/**
 * Cart drawer — the "Aero" off-canvas recipe (DESIGN-SPEC §3.2/§3.4): on desktop
 * a floating 440px panel inset by 4 from the top/right/bottom with
 * `shadow-panel` and near-square corners; a full-bleed sheet on mobile.
 * Header / scrollable item list / pinned footer, cream-and-espresso throughout.
 *
 * Every hook and handler below is the template's — this is a skin, not a rewire.
 */
export function CartModal() {
  const { cart } = useCart()
  const [isOpen, setIsOpen] = useState(false)

  const pathname = usePathname()

  useEffect(() => {
    // Close the cart modal when the pathname changes.
    setIsOpen(false)
  }, [pathname])

  const totalQuantity = useMemo(() => {
    if (!cart || !cart.items || !cart.items.length) return undefined
    return cart.items.reduce((quantity, item) => (item.quantity || 0) + quantity, 0)
  }, [cart])

  const isEmpty = !cart || !cart?.items?.length

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <OpenCartButton quantity={totalQuantity} />
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 border-gray-200 bg-white p-0 shadow-panel sm:max-w-none md:inset-y-4 md:right-4 md:h-auto md:w-[440px] md:rounded-default md:border">
        <SheetHeader className="shrink-0 gap-1 border-b border-gray-200 px-6 py-5 pr-16">
          <SheetTitle className="font-tech text-sm font-bold uppercase tracking-widest text-black">
            Nákupný košík
          </SheetTitle>
          <SheetDescription className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            {totalQuantity ? `${totalQuantity} ks v košíku` : 'Zatiaľ prázdny'}
          </SheetDescription>
        </SheetHeader>

        {isEmpty ? (
          <div className="flex grow flex-col items-center justify-center gap-4 px-8 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
              <ShoppingCart className="size-7" strokeWidth={1.5} />
            </span>
            <p className="font-sans text-base font-semibold text-black">Váš košík je prázdny</p>
            <p className="max-w-[260px] text-[13px] leading-relaxed text-gray-500">
              Ručne pletené deky, hračky a prútené dekorácie čakajú v našej ponuke.
            </p>
            <SheetClose asChild>
              <Link className="btn-primary group mt-2" href="/shop">
                Pokračovať v nákupe
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </SheetClose>
          </div>
        ) : (
          <React.Fragment>
            <ul className="grow overflow-y-auto px-6">
              {cart?.items?.map((item, i) => {
                const product = item.product
                const variant = item.variant

                if (typeof product !== 'object' || !item || !product || !product.slug)
                  return <React.Fragment key={i} />

                const metaImage =
                  product.meta?.image && typeof product.meta?.image === 'object'
                    ? product.meta.image
                    : undefined

                const firstGalleryImage =
                  typeof product.gallery?.[0]?.image === 'object'
                    ? product.gallery?.[0]?.image
                    : undefined

                let image = firstGalleryImage || metaImage
                let price = product.priceInUSD

                const isVariant = Boolean(variant) && typeof variant === 'object'

                if (isVariant) {
                  price = variant?.priceInUSD

                  const imageVariant = product.gallery?.find((item: GalleryItem) => {
                    if (!item.variantOption) return false
                    const variantOptionID =
                      typeof item.variantOption === 'object'
                        ? item.variantOption.id
                        : item.variantOption

                    const hasMatch = variant?.options?.some((option: VariantOptionRef) => {
                      if (typeof option === 'object') return option.id === variantOptionID
                      else return option === variantOptionID
                    })

                    return hasMatch
                  })

                  if (imageVariant && typeof imageVariant.image === 'object') {
                    image = imageVariant.image
                  }
                }

                return (
                  <li className="border-b border-gray-100 py-4 last:border-b-0" key={i}>
                    <div className="flex gap-4">
                      <Link
                        className="relative h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-gray-50"
                        href={`/products/${(product as Product)?.slug}`}
                      >
                        {image?.url && (
                          <Image
                            alt={image?.alt || product?.title || ''}
                            className="h-full w-full object-contain p-2 mix-blend-multiply"
                            height={128}
                            src={image.url}
                            width={104}
                          />
                        )}
                      </Link>

                      <div className="flex min-w-0 grow flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            className="line-clamp-2 font-sans text-[13px] font-medium leading-snug text-black transition-colors hover:text-brand"
                            href={`/products/${(product as Product)?.slug}`}
                          >
                            {product?.title}
                          </Link>
                          <DeleteItemButton item={item} />
                        </div>

                        {isVariant && variant && typeof variant === 'object' ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {variant.options?.map((option: VariantOptionRef, index: number) => {
                              if (typeof option !== 'object') return null
                              return (
                                <span
                                  className="inline-flex items-center rounded-sm border border-gray-200 bg-white px-1.5 py-0.5 font-tech text-[10px] font-bold uppercase tracking-wider text-gray-600"
                                  key={index}
                                >
                                  {option.label}
                                </span>
                              )
                            })}
                          </div>
                        ) : null}

                        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                          <div className="flex h-11 items-center rounded-default border border-gray-200">
                            <EditItemQuantityButton item={item} type="minus" />
                            <span className="w-8 text-center font-tech text-sm font-bold text-black">
                              {item.quantity}
                            </span>
                            <EditItemQuantityButton item={item} type="plus" />
                          </div>

                          {typeof price === 'number' && (
                            <Price
                              amount={price * (item.quantity || 1)}
                              as="span"
                              className="font-tech text-base font-bold leading-none text-black"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-5 shadow-panel-top md:rounded-b-md">
              {typeof cart?.subtotal === 'number' && (
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Medzisúčet
                  </span>
                  <Price
                    amount={cart?.subtotal}
                    as="span"
                    className="font-tech text-xl font-black leading-none text-black"
                  />
                </div>
              )}

              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                Doprava a dane sa vypočítajú pri pokladni.
              </p>

              <Link className="btn-checkout mt-4 text-xs" href="/checkout">
                Prejsť do pokladne
              </Link>

              <SheetClose asChild>
                <button
                  className="mt-3 w-full text-center font-sans text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-brand"
                  type="button"
                >
                  Pokračovať v nákupe
                </button>
              </SheetClose>
            </div>
          </React.Fragment>
        )}
      </SheetContent>
    </Sheet>
  )
}
