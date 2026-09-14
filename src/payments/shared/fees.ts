import type { PayloadRequest } from 'payload'

import type { PaymentMethod, ShippingMethod } from '@/payload-types'

/**
 * Resolved, server-trusted checkout surcharges.
 *
 * The browser only ever sends the *IDs* of the picked shipping/payment method;
 * every amount below is read back out of the database here, so a tampered
 * request cannot buy itself free delivery or skip the dobierka fee.
 */
export type ResolvedFees = {
  /** Dobierka (cash-on-delivery) surcharge in minor units. */
  codFee: number
  paymentMethod: PaymentMethod | null
  /** `cod` | `bankTransfer` | `card`, mirrored onto the order. */
  paymentType: PaymentMethod['type'] | null
  /** Delivery price in minor units. */
  shippingFee: number
  shippingMethod: ShippingMethod | null
  shippingMethodID: null | number | string
}

export const emptyFees: ResolvedFees = {
  codFee: 0,
  paymentMethod: null,
  paymentType: null,
  shippingFee: 0,
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
 * Look up the selected shipping/payment methods and turn them into amounts.
 *
 * Both lookups are tolerant: a missing or disabled method resolves to a zero
 * fee rather than throwing, because the caller (the payment adapter) validates
 * the *selection* separately and returns a shopper-readable error.
 */
export const resolveFees = async ({
  paymentMethodID,
  req,
  shippingMethodID,
}: {
  paymentMethodID?: unknown
  req: PayloadRequest
  shippingMethodID?: unknown
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

  return {
    codFee: paymentMethod?.enabled ? (paymentMethod.surcharge ?? 0) : 0,
    paymentMethod,
    paymentType: paymentMethod?.type ?? null,
    shippingFee: shippingMethod?.enabled ? (shippingMethod.price ?? 0) : 0,
    shippingMethod,
    shippingMethodID: shippingMethod?.id ?? null,
  }
}

/** Order grand total: cart subtotal + delivery + payment surcharge. */
export const calculateOrderTotal = (subtotal: number, fees: ResolvedFees): number =>
  subtotal + fees.shippingFee + fees.codFee
