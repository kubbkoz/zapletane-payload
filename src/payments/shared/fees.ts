import type { PayloadRequest } from 'payload'

import type { PaymentMethod, ShippingMethod } from '@/payload-types'

import { evaluateDiscountCode } from '@/payments/shared/discounts'
import { qualifiesForFreeShipping } from '@/payments/shared/rules'

/**
 * Resolved, server-trusted checkout surcharges.
 *
 * The browser only ever sends the *IDs* of the picked shipping/payment method
 * and the discount code as a plain string; every amount below is read back out
 * of the database here, so a tampered request cannot buy itself free delivery,
 * skip the dobierka fee or invent a discount.
 */
export type ResolvedFees = {
  /** Dobierka (cash-on-delivery) surcharge in minor units. */
  codFee: number
  /** Amount subtracted from the product subtotal, in minor units. */
  discountAmount: number
  /** Normalised (uppercase) code actually applied, or null. */
  discountCode: null | string
  discountCodeID: null | number | string
  /** Slovak reason the submitted code was refused, if it was. */
  discountError: null | string
  paymentMethod: PaymentMethod | null
  /** `cod` | `bankTransfer` | `card`, mirrored onto the order. */
  paymentType: PaymentMethod['type'] | null
  /** Delivery price in minor units, already zeroed by the free-shipping rule. */
  shippingFee: number
  /** True when `shippingFee` was zeroed by `freeAboveSubtotal`. */
  shippingIsFree: boolean
  shippingMethod: ShippingMethod | null
  shippingMethodID: null | number | string
}

export const emptyFees: ResolvedFees = {
  codFee: 0,
  discountAmount: 0,
  discountCode: null,
  discountCodeID: null,
  discountError: null,
  paymentMethod: null,
  paymentType: null,
  shippingFee: 0,
  shippingIsFree: false,
  shippingMethod: null,
  shippingMethodID: null,
}

const toID = (value: unknown): null | number | string => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return (value as { id: number | string }).id
  }
  return null
}

/**
 * Look up the selected shipping/payment methods and the discount code, and turn
 * them into amounts.
 *
 * The method lookups are tolerant: a missing or disabled method resolves to a
 * zero fee rather than throwing, because the caller (the payment adapter)
 * validates the *selection* separately and returns a shopper-readable error.
 * A refused discount code is reported in `discountError` for the caller to act
 * on — silently charging more than the checkout showed would be worse.
 */
export const resolveFees = async ({
  discountCode,
  paymentMethodID,
  req,
  shippingMethodID,
  subtotal = 0,
}: {
  discountCode?: unknown
  paymentMethodID?: unknown
  req: PayloadRequest
  shippingMethodID?: unknown
  /** Product subtotal in minor units, from the server-loaded cart. */
  subtotal?: number
}): Promise<ResolvedFees> => {
  const { payload } = req

  const shippingID = toID(shippingMethodID)
  const paymentID = toID(paymentMethodID)

  let shippingMethod: null | ShippingMethod = null
  let paymentMethod: null | PaymentMethod = null

  if (shippingID !== null) {
    try {
      shippingMethod = (await payload.findByID({
        id: shippingID,
        collection: 'shipping-methods',
        depth: 0,
        req,
      })) as ShippingMethod
    } catch {
      shippingMethod = null
    }
  }

  if (paymentID !== null) {
    try {
      paymentMethod = (await payload.findByID({
        id: paymentID,
        collection: 'payment-methods',
        depth: 0,
        req,
      })) as PaymentMethod
    } catch {
      paymentMethod = null
    }
  }

  const shippingIsFree = qualifiesForFreeShipping(shippingMethod, subtotal)

  let discountAmount = 0
  let resolvedCode: null | string = null
  let discountCodeID: null | number | string = null
  let discountError: null | string = null

  if (typeof discountCode === 'string' && discountCode.trim()) {
    const evaluation = await evaluateDiscountCode({ code: discountCode, payload, req, subtotal })

    if (evaluation.ok) {
      discountAmount = evaluation.amount
      resolvedCode = evaluation.code
      discountCodeID = evaluation.discount.id
    } else {
      discountError = evaluation.message
    }
  }

  return {
    codFee: paymentMethod?.enabled ? (paymentMethod.surcharge ?? 0) : 0,
    discountAmount,
    discountCode: resolvedCode,
    discountCodeID,
    discountError,
    paymentMethod,
    paymentType: paymentMethod?.type ?? null,
    shippingFee: shippingMethod?.enabled ? (shippingIsFree ? 0 : (shippingMethod.price ?? 0)) : 0,
    shippingIsFree,
    shippingMethod,
    shippingMethodID: shippingMethod?.id ?? null,
  }
}

/**
 * Order grand total.
 *
 *   max(0, subtotal - discount) + delivery + payment surcharge
 *
 * The discount applies to the product subtotal only — never to the delivery
 * price or the dobierka fee — and is floored at zero, so a code worth more than
 * the basket cannot make the shop owe the shopper the difference. `shippingFee`
 * is already zero when the free-delivery threshold was met (see `resolveFees`).
 */
export const calculateOrderTotal = (subtotal: number, fees: ResolvedFees): number =>
  Math.max(0, subtotal - fees.discountAmount) + fees.shippingFee + fees.codFee
