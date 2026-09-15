import type { BasePayload, PayloadRequest } from 'payload'

import type { DiscountCode } from '@/payload-types'

import { computeDiscountAmount, formatEurocents } from '@/payments/shared/rules'

/**
 * Zľavové kódy — the single place a discount code is ever evaluated.
 *
 * Both entry points funnel through `evaluateDiscountCode`:
 *
 *   - POST /api/discount-codes/validate  -> the "Použiť" button in the checkout
 *     summary. Answers with a Slovak reason or the amount to preview.
 *   - resolveFees() in ./fees.ts         -> every order-creating path (manual +
 *     Comgate `initiatePayment`). The amount written onto the transaction and
 *     the order comes from HERE, recomputed against the server-loaded cart
 *     subtotal — a code the browser sends is only ever a *string*, never an
 *     amount.
 *
 * `usedCount` is deliberately NOT touched by this module: validating a code in
 * the checkout must not consume it. It is incremented once, atomically, when a
 * transaction actually becomes an order (see ./orders.ts).
 */

export type DiscountFailure = { message: string; ok: false }

export type DiscountSuccess = {
  /** Amount to subtract from the product subtotal, in minor units. */
  amount: number
  /** The normalised (uppercase) code as stored. */
  code: string
  discount: DiscountCode
  ok: true
}

export type DiscountEvaluation = DiscountFailure | DiscountSuccess

/**
 * Validate every constraint on a code and compute what it is worth.
 *
 * Runs with the Local API (`overrideAccess` defaults to true), because the
 * `discount-codes` collection is admin-only on purpose — a shopper may use a
 * code they know, but must never be able to list or read them.
 */
export const evaluateDiscountCode = async ({
  code,
  payload,
  req,
  subtotal,
}: {
  code: unknown
  payload: BasePayload
  req?: PayloadRequest
  subtotal: number
}): Promise<DiscountEvaluation> => {
  if (typeof code !== 'string' || !code.trim()) {
    return { message: 'Zadajte zľavový kód.', ok: false }
  }

  const normalised = code.trim().toUpperCase()

  if (normalised.length > 64) {
    return { message: 'Zľavový kód sme nenašli.', ok: false }
  }

  const { docs } = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    ...(req ? { req } : {}),
    where: { code: { equals: normalised } },
  })

  const discount = docs[0]

  // One deliberately vague answer for "no such code" and "code is switched
  // off": neither tells a guesser whether they hit a real code.
  if (!discount || !discount.enabled) {
    return { message: 'Zľavový kód sme nenašli alebo už nie je platný.', ok: false }
  }

  const now = Date.now()

  if (discount.validFrom && new Date(discount.validFrom).getTime() > now) {
    return { message: 'Platnosť tohto zľavového kódu sa ešte nezačala.', ok: false }
  }

  if (discount.validUntil && new Date(discount.validUntil).getTime() < now) {
    return { message: 'Platnosť tohto zľavového kódu už uplynula.', ok: false }
  }

  if (typeof discount.maxUses === 'number' && discount.maxUses > 0) {
    if ((discount.usedCount ?? 0) >= discount.maxUses) {
      return { message: 'Tento zľavový kód už bol vyčerpaný.', ok: false }
    }
  }

  if (typeof discount.minSubtotal === 'number' && discount.minSubtotal > 0) {
    if (subtotal < discount.minSubtotal) {
      return {
        message: `Zľavový kód platí až pri nákupe od ${formatEurocents(discount.minSubtotal)}.`,
        ok: false,
      }
    }
  }

  const amount = computeDiscountAmount(discount, subtotal)

  if (amount <= 0) {
    return { message: 'Tento zľavový kód sa na váš košík nedá uplatniť.', ok: false }
  }

  return { amount, code: normalised, discount, ok: true }
}

/**
 * Consume one use of a code, atomically, at the moment an order is created.
 *
 * Uses `payload.db.updateOne` with `$inc` — the same primitive the inventory
 * decrement uses — so two checkouts finishing at once cannot both read
 * `usedCount: 4` and both write `5`. Never called from the validate route.
 */
export const incrementDiscountUsage = async ({
  discountCodeID,
  payload,
}: {
  discountCodeID: null | number | string | undefined
  payload: BasePayload
}): Promise<void> => {
  if (discountCodeID === null || discountCodeID === undefined || discountCodeID === '') {
    return
  }

  const id = typeof discountCodeID === 'string' ? Number(discountCodeID) : discountCodeID

  if (typeof id === 'number' && Number.isNaN(id)) {
    return
  }

  try {
    await payload.db.updateOne({
      id,
      collection: 'discount-codes',
      data: { usedCount: { $inc: 1 } } as never,
    })
  } catch (error) {
    // A failed counter must never undo a paid order — log and move on.
    payload.logger.error({ err: error }, `[discount-codes] Could not increment usedCount for ${id}`)
  }
}
