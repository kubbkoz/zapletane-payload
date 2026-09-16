'use client'

import { Heart } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/cn'
import { useWishlist } from '@/wishlist/WishlistProvider'

type Props = {
  className?: string
  productID: number
  title?: string
}

/**
 * PDP wishlist toggle — same square-chip recipe and exact `useWishlist()`
 * behaviour as the card's heart (`ProductGridItem/CardActions.tsx`
 * `CardWishlistButton`, left untouched per the Z18 scope): a guest's click
 * never writes anything, `toggle()` opens the "Prihláste sa" modal the
 * provider already mounts. Sized to sit beside the "Pridať do košíka" button
 * (`h-12 w-12`, matching its fixed height exactly) rather than pinned over a
 * card thumbnail.
 */
export function PdpWishlistButton({ className, productID, title }: Props) {
  const wishlist = useWishlist()

  if (!wishlist) return null

  const saved = wishlist.isAuthenticated && wishlist.has(productID)

  return (
    <button
      aria-label={
        saved
          ? `Odstrániť ${title || 'produkt'} z obľúbených`
          : `Uložiť ${title || 'produkt'} medzi obľúbené`
      }
      aria-pressed={saved}
      className={cn(
        'flex h-12 w-12 flex-none items-center justify-center rounded-default border border-gray-200 bg-white text-gray-500 transition-colors duration-200 hover:border-brand hover:text-brand',
        saved && 'border-brand text-brand',
        className,
      )}
      onClick={() => wishlist.toggle(productID)}
      type="button"
    >
      <Heart className={cn('h-5 w-5', saved && 'fill-brand')} strokeWidth={1.75} />
    </button>
  )
}
