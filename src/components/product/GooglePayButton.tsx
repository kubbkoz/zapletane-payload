'use client'

import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/utilities/cn'

type Props = {
  className?: string
  disabled?: boolean
  product: Product
  quantity: number
}

/**
 * "Kúpiť cez Google Pay" express PDP CTA (Z18 owner spec).
 *
 * Visibility is decided one level up — `page.tsx` resolves server-side
 * whether an enabled `payment-methods` row of type `card` exists and only
 * then mounts this component at all, so there is nothing to gate here.
 *
 * Standard merchant Google Pay button per Google's brand guidelines: solid
 * black surface, the official multi-colour "G" mark, white "Pay" wordmark —
 * built inline since this storefront has no Google Pay SDK integration
 * (Comgate is the card gateway); the button itself is the ordinary
 * add-to-cart + redirect-to-checkout flow every other CTA here uses, not an
 * actual Google Pay session.
 *
 * Behaviour: adds the selected quantity to the cart, then hands off to
 * `/checkout?platba=karta`, which `CheckoutPage.tsx` reads to preselect the
 * card payment method.
 */
export function GooglePayButton({ className, disabled, product, quantity }: Props) {
  const { addItem } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)

  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<undefined | Variant>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')

      const match = variants.find((variant) =>
        typeof variant === 'object'
          ? String(variant.id) === variantId
          : String(variant) === variantId,
      )

      if (match && typeof match === 'object') return match
    }

    return undefined
  }, [product.enableVariants, searchParams, variants])

  const onBuy = useCallback(() => {
    if (disabled || pending) return
    if (product.enableVariants && !selectedVariant) return

    setPending(true)

    addItem({ product: product.id, variant: selectedVariant?.id ?? undefined }, quantity)
      .then(() => {
        router.push('/checkout?platba=karta')
      })
      .catch(() => {
        toast.error('Nepodarilo sa spustiť platbu cez Google Pay.')
        setPending(false)
      })
  }, [addItem, disabled, pending, product, quantity, router, selectedVariant])

  return (
    <button
      aria-label="Kúpiť cez Google Pay"
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-default bg-black transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      disabled={disabled || pending}
      onClick={onBuy}
      type="button"
    >
      {/* Official Google "G" glyph — required unaltered on any Google Pay button. */}
      <svg aria-hidden="true" height="20" viewBox="0 0 48 48" width="20">
        <path
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
          fill="#4285F4"
        />
        <path
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A22 22 0 0 0 24 46Z"
          fill="#34A853"
        />
        <path
          d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34a22 22 0 0 0 0 19.76l7.35-5.7Z"
          fill="#FBBC05"
        />
        <path
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2A22 22 0 0 0 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75Z"
          fill="#EA4335"
        />
      </svg>
      <span className="font-sans text-[15px] font-medium leading-none text-white">Pay</span>
    </button>
  )
}
