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
import { cn } from '@/utilities/cn'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { ArrowRight, ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { QuantityStepper } from '@/components/product/QuantityStepper'
import { CartCrossSell } from './CartCrossSell'
import { useCartDrawer } from './CartDrawerProvider'
import { DeleteItemButton } from './DeleteItemButton'
import { OpenCartButton } from './OpenCart'
import { useIsMobileViewport } from './useIsMobileViewport'
import { Product, Variant } from '@/payload-types'
import type { CartItem } from './index'

type GalleryItem = NonNullable<Product['gallery']>[number]
type VariantOptionRef = Variant['options'][number]

/**
 * Cart-line quantity control — the shared `QuantityStepper` markup (Z18),
 * bridged onto the only client-side primitives the cart hook exposes:
 * `incrementItem`/`decrementItem`, each worth exactly ±1. A typed/clamped
 * jump of more than one step is walked there via repeated calls — the same
 * calls the old +/- buttons made (`EditItemQuantityButton`, now unused
 * here), never a new "set quantity" operation. `min={0}` is deliberate: the
 * drawer's original behaviour let decrementing the last unit remove the
 * line entirely (the server's `removeOnZero` default) — a `min` of `1`
 * (the PDP's default) would silently break that.
 */
function CartItemQuantityStepper({ item }: { item: CartItem }) {
  const { decrementItem, incrementItem, isLoading } = useCart()

  const target =
    item.variant && typeof item.variant === 'object'
      ? item.variant
      : item.product && typeof item.product === 'object'
        ? item.product
        : null

  const maxQuantity =
    target && typeof target === 'object' && typeof target.inventory === 'number'
      ? target.inventory
      : undefined

  const quantity = item.quantity ?? 1

  const onChange = useCallback(
    async (next: number) => {
      if (!item.id || next === quantity) return

      const steps = Math.abs(next - quantity)

      for (let i = 0; i < steps; i++) {
        if (next > quantity) {
          await incrementItem(item.id)
        } else {
          await decrementItem(item.id)
        }
      }
    },
    [decrementItem, incrementItem, item.id, quantity],
  )

  return (
    <QuantityStepper
      disabled={isLoading || !item.id}
      max={maxQuantity}
      min={0}
      onChange={(next) => void onChange(next)}
      value={quantity}
    />
  )
}

/**
 * Cart drawer — the "Aero" off-canvas recipe (DESIGN-SPEC §3.2/§3.4): on desktop
 * a floating 440px panel inset by 4 from the top/right/bottom with
 * `shadow-panel` and near-square corners. Below `md` the same panel becomes a
 * bottom sheet — it slides up from the bottom edge, capped at 85dvh, with a
 * grabber and rounded top corners — which is what §3.2's Aero standard already
 * prescribed for mobile ("mobile floats from the bottom") and what an app-shell
 * layout with a fixed bottom bar wants.
 *
 * Radix cannot make `side` responsive on its own (it is a prop, not a class),
 * so the side is chosen from `useIsMobileViewport()` and the panel's own
 * positioning classes follow it. There is no first-paint flash: the sheet's
 * content is only mounted once it opens, always after hydration, so the
 * SSR-safe `false` default is never the value anything paints with.
 *
 * Open state comes from `CartDrawerProvider` when one is mounted (the layout
 * mounts it), so the mobile bottom bar opens this exact drawer; without a
 * provider it falls back to local state and behaves exactly as before.
 *
 * Every hook and handler below is the template's — this is a skin, not a rewire.
 */
export function CartModal() {
  const { cart } = useCart()
  const drawer = useCartDrawer()
  const [localOpen, setLocalOpen] = useState(false)

  const isOpen = drawer ? drawer.isOpen : localOpen
  const setIsOpen = drawer ? drawer.setOpen : setLocalOpen

  const isMobile = useIsMobileViewport()
  const side = isMobile ? 'bottom' : 'right'

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

  const cartProductIds = useMemo(() => {
    const ids = new Set<number>()
    for (const item of cart?.items || []) {
      const id = typeof item.product === 'object' ? item.product?.id : item.product
      if (typeof id === 'number') ids.add(id)
    }
    return Array.from(ids)
  }, [cart?.items])

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <OpenCartButton quantity={totalQuantity} />
      </SheetTrigger>

      <SheetContent
        className={cn(
          'flex w-full flex-col gap-0 border-gray-200 bg-white p-0 shadow-panel sm:max-w-none',
          side === 'bottom'
            ? // Bottom sheet: capped so the page stays visible behind it, with
              // the grabber's breathing room above the header.
              'h-auto max-h-[85dvh] rounded-t-[12px] border-t'
            : 'md:inset-y-4 md:right-4 md:h-auto md:w-[440px] md:rounded-default md:border',
        )}
        side={side}
      >
        {side === 'bottom' ? (
          <div
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-gray-200"
          />
        ) : null}

        <SheetHeader
          className={cn(
            'shrink-0 gap-1 border-b border-gray-200 px-6 py-5 pr-16',
            side === 'bottom' && 'pt-3',
          )}
        >
          <SheetTitle className="font-tech text-sm font-bold uppercase tracking-widest text-black">
            Nákupný košík
          </SheetTitle>
          <SheetDescription className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            {totalQuantity ? `${totalQuantity} ks v košíku` : 'Zatiaľ prázdny'}
          </SheetDescription>
        </SheetHeader>

        {isEmpty ? (
          <div
            className={cn(
              'flex grow flex-col items-center justify-center gap-4 px-8 py-16 text-center',
              side === 'bottom' && 'pb-[calc(4rem+env(safe-area-inset-bottom))]',
            )}
          >
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
            {/* `min-h-0` lets the list actually scroll inside the capped
                bottom sheet (a flex child defaults to min-height:auto). The
                cross-sell strip lives inside this same scroll container
                (below the items) so it can never push the capped-height
                sheet's footer off-screen. */}
            <div className="min-h-0 grow overflow-y-auto">
              <ul className="px-6">
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
                  let price = product.priceInEUR

                  const isVariant = Boolean(variant) && typeof variant === 'object'

                  if (isVariant) {
                    price = variant?.priceInEUR

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
                            <CartItemQuantityStepper item={item} />

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

              <CartCrossSell productIds={cartProductIds} />
            </div>

            <div
              className={cn(
                'shrink-0 border-t border-gray-200 bg-white px-6 py-5 shadow-panel-top md:rounded-b-md',
                // Home-indicator clearance on the bottom sheet (the desktop
                // panel floats inset by 4 and needs none).
                side === 'bottom' && 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
              )}
            >
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
