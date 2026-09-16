'use client'

import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Loader2, ShoppingCart } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { cn } from '@/utilities/cn'

type Props = {
  product: Product
  className?: string
  /**
   * Selected quantity to add (Z18 — the PDP's `QuantityStepper` controls
   * this). Defaults to 1, matching every other caller (the product card's
   * `CardAddToCartButton` still adds a single unit).
   */
  quantity?: number
}

/**
 * PDP primary CTA. Visual layer only — the cart wiring (useCart/addItem, the
 * inventory-aware disabled rule) is byte-for-byte the template's, now
 * extended to pass the selected `quantity` straight through to `addItem`'s
 * own `quantity` parameter (`@payloadcms/plugin-ecommerce/client/react`
 * supports it natively — no loop needed).
 *
 * Styling is `BaseButton variant="primary" size="lg"` from DESIGN-SPEC §3.7:
 * bg-accent / hover bg-accent-dark, white text, uppercase tracking-widest,
 * rounded-default. `flex-1` (not a fixed width) because the CTA now shares a
 * row with the wishlist square button (Z18 purchase-panel redesign).
 */
export function AddToCart({ product, className, quantity = 1 }: Props) {
  const { addItem, cart, isLoading } = useCart()
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

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      const qty = Math.max(1, Math.trunc(quantity) || 1)

      addItem(
        {
          product: product.id,
          variant: selectedVariant?.id ?? undefined,
        },
        qty,
      ).then(() => {
        toast.success('Produkt bol pridaný do košíka.')
      })
    },
    [addItem, product, quantity, selectedVariant],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const variantID = item.variant
        ? typeof item.variant === 'object'
          ? item.variant?.id
          : item.variant
        : undefined

      if (productID === product.id) {
        if (product.enableVariants) {
          return variantID === selectedVariant?.id
        }
        return true
      }
    })

    if (existingItem) {
      const existingQuantity = existingItem.quantity

      if (product.enableVariants) {
        return existingQuantity >= (selectedVariant?.inventory || 0)
      }
      return existingQuantity >= (product.inventory || 0)
    }

    if (product.enableVariants) {
      if (!selectedVariant) {
        return true
      }

      if (selectedVariant.inventory === 0) {
        return true
      }
    } else {
      if (product.inventory === 0) {
        return true
      }
    }

    return false
  }, [selectedVariant, cart?.items, product])

  const label = useMemo<string>(() => {
    if (isLoading) return 'Pridávam...'
    if (product.enableVariants && !selectedVariant) return 'Vyberte si veľkosť'
    if (product.enableVariants ? selectedVariant?.inventory === 0 : product.inventory === 0) {
      return 'Vypredané'
    }
    return 'Pridať do košíka'
  }, [isLoading, product.enableVariants, product.inventory, selectedVariant])

  return (
    <button
      aria-label="Pridať do košíka"
      className={cn(
        'inline-flex h-12 flex-1 items-center justify-center gap-3 rounded-default border border-accent bg-accent px-6 font-sans text-sm font-bold uppercase tracking-widest text-white transition-colors duration-300 hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      disabled={disabled || isLoading}
      onClick={addToCart}
      type="submit"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      {label}
    </button>
  )
}
