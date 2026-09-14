'use client'

import { CartItem } from '@/components/Cart'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import React, { useMemo } from 'react'

import { cn } from '@/utilities/cn'

/**
 * Quantity stepper half. 44×44 minimum hit area (WCAG 2.5.5, called out for the
 * cart in DESIGN-SPEC §3.4), near-square corners, brand-brown hover. All
 * increment/decrement/inventory logic below is the template's, unchanged.
 */
export function EditItemQuantityButton({ type, item }: { item: CartItem; type: 'minus' | 'plus' }) {
  const { decrementItem, incrementItem, isLoading } = useCart()

  const disabled = useMemo(() => {
    if (!item.id) return true

    const target =
      item.variant && typeof item.variant === 'object'
        ? item.variant
        : item.product && typeof item.product === 'object'
          ? item.product
          : null

    if (
      target &&
      typeof target === 'object' &&
      target.inventory !== undefined &&
      target.inventory !== null
    ) {
      if (type === 'plus' && item.quantity !== undefined && item.quantity !== null) {
        return item.quantity >= target.inventory
      }
    }

    return false
  }, [item, type])

  return (
    <button
      aria-label={type === 'plus' ? 'Zvýšiť množstvo' : 'Znížiť množstvo'}
      className={cn(
        'flex h-11 w-11 flex-none items-center justify-center text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-brand',
        {
          'cursor-not-allowed text-gray-300 hover:bg-transparent hover:text-gray-300':
            disabled || isLoading,
        },
      )}
      disabled={disabled || isLoading}
      onClick={(e: React.FormEvent<HTMLButtonElement>) => {
        e.preventDefault()

        if (item.id) {
          if (type === 'plus') {
            incrementItem(item.id)
          } else {
            decrementItem(item.id)
          }
        }
      }}
      type="button"
    >
      {type === 'plus' ? <PlusIcon className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" />}
    </button>
  )
}
