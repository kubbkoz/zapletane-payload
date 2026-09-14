'use client'

import type { CartItem } from '@/components/Cart'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { XIcon } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/cn'

/**
 * Cart line-item remove. Quiet by default (gray-300), warms to the brand brown
 * on hover — the same "quiet until you reach for it" treatment the product
 * card's wishlist/compare icons use. Wiring untouched.
 */
export function DeleteItemButton({ item }: { item: CartItem }) {
  const { isLoading, removeItem } = useCart()
  const itemId = item.id

  return (
    <button
      aria-label="Odstrániť položku z košíka"
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-default text-gray-300 transition-colors duration-200 hover:bg-gray-50 hover:text-brand',
        {
          'cursor-not-allowed opacity-50': !itemId || isLoading,
        },
      )}
      disabled={!itemId || isLoading}
      onClick={(e: React.FormEvent<HTMLButtonElement>) => {
        e.preventDefault()
        if (itemId) removeItem(itemId)
      }}
      title="Odstrániť z košíka"
      type="button"
    >
      <XIcon className="h-4 w-4" />
    </button>
  )
}
