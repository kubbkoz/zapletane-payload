import type { DiscountCode, ShippingMethod } from '@/payload-types'

/**
 * Pure checkout arithmetic — no Payload runtime, no database, no `req`.
 *
 * This module exists so the browser and the server can run *the same* rules:
 * `src/payments/shared/fees.ts` (server, authoritative) and the checkout
 * components (client, cosmetic) both import from here, which is what keeps the
 * "Zadarmo od 100 €" hint and the price actually charged from ever drifting
 * apart. Importing fees.ts or discounts.ts into a client component would pull
 * the Payload Local API into the browser bundle; importing this cannot.
 */

/** eurocents -> "12,50 €". */
export const formatEurocents = (amount: number): string =>
  new Intl.NumberFormat('sk-SK', { currency: 'EUR', style: 'currency' }).format(amount / 100)

/**
 * Is this delivery free for a basket of `subtotal`?
 *
 * The threshold is compared against the product subtotal BEFORE fees and
 * BEFORE any discount code — that is the „Medzisúčet" line the shopper is
 * looking at while deciding to add one more item, so anything else would read
 * as a bait-and-switch.
 */
export const qualifiesForFreeShipping = (
  method: null | Pick<ShippingMethod, 'freeAboveSubtotal'> | undefined,
  subtotal: number,
): boolean => {
  const threshold = method?.freeAboveSubtotal

  return typeof threshold === 'number' && threshold > 0 && subtotal >= threshold
}

/** Eurocents still missing before `method` ships for free; 0 when it already does. */
export const amountMissingForFreeShipping = (
  method: null | Pick<ShippingMethod, 'freeAboveSubtotal'> | undefined,
  subtotal: number,
): number => {
  const threshold = method?.freeAboveSubtotal

  if (typeof threshold !== 'number' || threshold <= 0 || subtotal >= threshold) {
    return 0
  }

  return threshold - subtotal
}

/**
 * Turn a code + a subtotal into an amount. Percentages round down (to the
 * shop's advantage, and so the result is always an integer number of cents),
 * and the result never exceeds the subtotal it is taken from — a 50 € code on a
 * 30 € basket discounts 30 €, it does not pay the shopper 20 €.
 */
export const computeDiscountAmount = (
  discount: Pick<DiscountCode, 'type' | 'value'>,
  subtotal: number,
): number => {
  if (subtotal <= 0) {
    return 0
  }

  const value = discount.value ?? 0

  const raw =
    discount.type === 'percent'
      ? Math.floor((subtotal * Math.min(Math.max(value, 0), 100)) / 100)
      : Math.max(Math.floor(value), 0)

  return Math.min(raw, subtotal)
}
