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
}

/**
 * PDP primary CTA. Visual layer only — the cart wiring (useCart/addItem, the
 * inventory-aware disabled rule) is byte-for-byte the template's.
 *
 * Styling is `BaseButton variant="primary" size="lg"` from DESIGN-SPEC §3.7:
 * bg-accent / hover bg-accent-dark, white text, uppercase tracking-widest,
 * rounded-default — full width on mobile, fixed min-width on desktop (§3.3).
 */
export function AddToCart({ product, className }: Props) {
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

      addItem({
        product: product.id,
        variant: selectedVariant?.id ?? undefined,
      }).then(() => {
        toast.success('Produkt bol pridaný do košíka.')
      })
    },
    [addItem, product, selectedVariant],
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
        'inline-flex w-full items-center justify-center gap-3 rounded-default border border-accent bg-accent px-8 py-4 font-sans text-sm font-bold uppercase tracking-widest text-white transition-colors duration-300 hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[260px]',
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
