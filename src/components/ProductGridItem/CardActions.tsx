'use client'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Heart, Loader2, ShoppingCart } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/utilities/cn'
import { useWishlist } from '@/wishlist/WishlistProvider'

import { cardActionClass } from './cardActionClass'

/**
 * Heart chip pinned to the top-right of the card's image zone.
 *
 * The whole card is one big `<Link>`, so the click is swallowed here
 * (`preventDefault` + `stopPropagation`) — hearting a product must never
 * navigate to it. `rounded-default` on purpose: design.md bans `rounded-full`
 * on interactive chips, and this is a button, not a badge.
 *
 * A guest's click never writes anything: `toggle` routes them to the
 * "Prihláste sa" modal instead (Z10 — the wishlist is customers-only).
 */
export function CardWishlistButton({ productID, title }: { productID: number; title?: string }) {
  const wishlist = useWishlist()

  if (!wishlist) return null

  const saved = wishlist.isAuthenticated && wishlist.has(productID)

  return (
    <button
      aria-label={saved ? `Odstrániť ${title || 'produkt'} z obľúbených` : `Uložiť ${title || 'produkt'} medzi obľúbené`}
      aria-pressed={saved}
      className={cn(
        'absolute right-2.5 top-2.5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-default border border-gray-100 bg-white/90 shadow-sm backdrop-blur-[2px] transition-colors duration-200 hover:border-brand hover:text-brand',
        saved ? 'text-brand' : 'text-gray-500',
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        wishlist.toggle(productID)
      }}
      type="button"
    >
      <Heart className={cn('h-[18px] w-[18px]', saved && 'fill-brand')} strokeWidth={1.75} />
    </button>
  )
}

/**
 * Card add-to-cart — the simple-product half of the card CTA.
 *
 * Wiring is the PDP's (`Cart/AddToCart.tsx`): `useCart().addItem` then the
 * shared Sonner toast. The PDP deliberately does NOT auto-open the cart drawer
 * after an add, so neither does this — one add, one behaviour, wherever the
 * shopper is standing.
 *
 * Disabled matches the PDP's inventory rule for a variant-less product: no
 * stock, or the cart already holds everything that is left.
 */
export function CardAddToCartButton({
  inventory,
  productID,
  title,
}: {
  inventory?: null | number
  productID: number
  title?: string
}) {
  const { addItem, cart } = useCart()
  const [pending, setPending] = useState(false)

  const disabled = useMemo<boolean>(() => {
    if (inventory === 0) return true

    const existingItem = cart?.items?.find((item) => {
      const itemProductID = typeof item.product === 'object' ? item.product?.id : item.product
      return itemProductID === productID && !item.variant
    })

    if (existingItem && typeof inventory === 'number') {
      return (existingItem.quantity || 0) >= inventory
    }

    return false
  }, [cart?.items, inventory, productID])

  const onAdd = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (disabled || pending) return

      setPending(true)

      void addItem({ product: productID })
        .then(() => {
          toast.success('Produkt bol pridaný do košíka.')
        })
        .catch(() => {
          toast.error('Produkt sa nepodarilo pridať do košíka.')
        })
        .finally(() => {
          setPending(false)
        })
    },
    [addItem, disabled, pending, productID],
  )

  return (
    <button
      aria-label={
        disabled
          ? `${title || 'Produkt'} — vypredané`
          : `Pridať ${title || 'produkt'} do košíka`
      }
      className={cn(cardActionClass, 'disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400')}
      disabled={disabled || pending}
      onClick={onAdd}
      type="button"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
      )}
    </button>
  )
}
