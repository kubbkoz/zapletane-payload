'use client'

import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { AddToCart } from '@/components/Cart/AddToCart'
import { GooglePayButton } from './GooglePayButton'
import { PdpWishlistButton } from './PdpWishlistButton'
import { QuantityStepper } from './QuantityStepper'
import { StockCounter } from './StockCounter'

type Props = {
  /** Server-resolved: does an enabled `payment-methods` row of type `card` exist? */
  cardPaymentEnabled: boolean
  product: Product
}

/**
 * PDP purchase panel (Z18 redesign) — everything below the price/variant
 * selector that needs the selected variant and a shared quantity: the stock
 * counter, the shared `QuantityStepper`, the add-to-cart + wishlist row, and
 * the Google Pay express button.
 *
 * One component (and one `<Suspense>` boundary up in `ProductDescription`)
 * on purpose: these pieces now share state (`quantity`) and a derived value
 * (the selected variant's inventory) that the old `StockIndicator`/
 * `AddToCart` — each independently `<Suspense>`-wrapped and each
 * recomputing the selected variant on its own — had no way to share.
 */
export function PurchasePanel({ cardPaymentEnabled, product }: Props) {
  const searchParams = useSearchParams()
  const { cart } = useCart()

  const enableVariants = Boolean(product.enableVariants)
  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<undefined | Variant>(() => {
    if (enableVariants && variants.length) {
      const variantId = searchParams.get('variant')

      const match = variants.find((variant) =>
        typeof variant === 'object'
          ? String(variant.id) === variantId
          : String(variant) === variantId,
      )

      if (match && typeof match === 'object') return match
    }

    return undefined
  }, [enableVariants, searchParams, variants])

  const noVariantSelected = enableVariants && !selectedVariant
  const inventory = enableVariants ? selectedVariant?.inventory : product.inventory

  // How much of the current stock is already sitting in this shopper's cart
  // for this exact product/variant — the stepper's `+` must stop there, not
  // at raw inventory, or it would let them dial in more than is left.
  const existingCartQuantity = useMemo(() => {
    const existingItem = cart?.items?.find((item) => {
      const itemProductID = typeof item.product === 'object' ? item.product?.id : item.product
      const itemVariantID = item.variant
        ? typeof item.variant === 'object'
          ? item.variant?.id
          : item.variant
        : undefined

      if (itemProductID !== product.id) return false
      return enableVariants ? itemVariantID === selectedVariant?.id : true
    })

    return existingItem?.quantity || 0
  }, [cart?.items, enableVariants, product.id, selectedVariant?.id])

  const soldOut = !noVariantSelected && typeof inventory === 'number' && inventory <= 0

  const maxQuantity = useMemo(() => {
    if (typeof inventory !== 'number') return undefined
    return Math.max(inventory - existingCartQuantity, 0)
  }, [existingCartQuantity, inventory])

  const purchaseDisabled =
    noVariantSelected || soldOut || (typeof maxQuantity === 'number' && maxQuantity <= 0)

  const [quantity, setQuantity] = useState(1)

  // Reset to 1 whenever the shopper switches variant/product — a leftover
  // quantity dialled in for a different size would be confusing, not helpful.
  useEffect(() => {
    setQuantity(1)
  }, [product.id, selectedVariant?.id])

  // Defensive clamp: if the room shrinks (e.g. the last pieces sell out in
  // another tab) while a higher quantity is still dialled in, pull it back.
  useEffect(() => {
    if (typeof maxQuantity === 'number' && maxQuantity > 0 && quantity > maxQuantity) {
      setQuantity(maxQuantity)
    }
  }, [maxQuantity, quantity])

  return (
    <div className="flex flex-col gap-6">
      {!noVariantSelected && (
        <StockCounter inventory={typeof inventory === 'number' ? inventory : null} />
      )}

      <div>
        <span className="form-label">Množstvo</span>
        <QuantityStepper
          className="self-start"
          disabled={purchaseDisabled}
          max={maxQuantity}
          onChange={setQuantity}
          value={quantity}
        />
      </div>

      <div className="flex gap-3">
        <AddToCart product={product} quantity={quantity} />
        <PdpWishlistButton productID={product.id} title={product.title} />
      </div>

      {cardPaymentEnabled && (
        <GooglePayButton disabled={purchaseDisabled} product={product} quantity={quantity} />
      )}
    </div>
  )
}
