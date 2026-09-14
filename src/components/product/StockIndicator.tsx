'use client'
import { Product, Variant } from '@/payload-types'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import { cn } from '@/utilities/cn'
import {
  getStockState,
  lowStockNote,
  stockBadgeClass,
  stockDotClass,
  stockLabel,
  stockTextClass,
} from '@/utilities/stockStatus'

type Props = {
  product: Product
}

/**
 * PDP stock pill — same three-state semantics and the same "breathe" glow as
 * the product card, so a shopper reads the identical signal in the listing and
 * on the detail page (DESIGN-SPEC §1.1 / §3.3).
 */
export const StockIndicator: React.FC<Props> = ({ product }) => {
  const searchParams = useSearchParams()

  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<Variant | undefined>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')
      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }

    return undefined
  }, [product.enableVariants, searchParams, variants])

  const stockQuantity = useMemo(() => {
    if (product.enableVariants) {
      if (selectedVariant) {
        return selectedVariant.inventory
      }
    }
    return product.inventory
  }, [product.enableVariants, selectedVariant, product.inventory])

  if (product.enableVariants && !selectedVariant) {
    return null
  }

  const state = getStockState(stockQuantity)
  const note = lowStockNote(stockQuantity)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className={cn(
          'inline-flex h-7 items-center gap-2 rounded-sm px-3',
          stockBadgeClass[state],
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', stockDotClass[state])} />
        <span className="whitespace-nowrap font-sans text-[12px] font-semibold leading-none">
          {stockLabel[state]}
        </span>
      </div>

      {note && (
        <span className={cn('font-sans text-[12px] font-medium', stockTextClass[state])}>
          {note}
        </span>
      )}

      {state === 'onOrder' && (
        <span className="font-sans text-[12px] font-medium text-gray-500">
          Vyrobíme a odošleme do niekoľkých dní
        </span>
      )}
    </div>
  )
}
