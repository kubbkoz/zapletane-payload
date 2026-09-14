'use client'
import { Product, Variant } from '@/payload-types'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import { cn } from '@/utilities/cn'
import {
  getStockState,
  lowStockNote,
  stockChipClass,
  stockLabel,
  stockTextClass,
} from '@/utilities/stockStatus'

import './stock-pulse.css'

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
          'relative flex h-8 items-center justify-center rounded-sm border px-3 text-center font-tech',
          stockChipClass[state],
        )}
      >
        <span className="whitespace-nowrap text-[11px] font-bold uppercase leading-none tracking-widest text-black">
          {stockLabel[state]}
        </span>
        {state === 'soldOut' && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <svg className="h-full w-full" preserveAspectRatio="none">
              <line x1="0" y1="100%" x2="100%" y2="0" stroke="#E4D2CB" strokeWidth="1" />
            </svg>
          </div>
        )}
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
