import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { evaluateDiscountCode } from '@/payments/shared/discounts'

export const dynamic = 'force-dynamic'

/**
 * POST /api/discount-codes/validate
 *
 * Backs the „Použiť" button next to the discount field in the checkout summary.
 * Every constraint — exists, enabled, validity window, max uses, minimum
 * subtotal — is checked HERE, server-side, against the `discount-codes`
 * collection (which the storefront cannot read directly: it is admin-only).
 *
 * What comes back is a *preview*. The `subtotal` in the request body is the
 * shopper's own basket total as the browser knows it, so the amount below is
 * only good enough to render a line in the summary. The amount that is actually
 * charged is recomputed in `resolveFees` from the cart Payload itself loaded,
 * at `initiatePayment`, and the code is re-validated there — so a tampered
 * `subtotal` here buys nothing beyond a wrong number on the shopper's own
 * screen, and a doctored client amount is never persisted anywhere.
 *
 * `usedCount` is untouched: validating a code does not consume it.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {}

  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Neplatná požiadavka.', ok: false }, { status: 400 })
  }

  const rawSubtotal = body.subtotal
  const subtotal =
    typeof rawSubtotal === 'number' && Number.isFinite(rawSubtotal) && rawSubtotal > 0
      ? Math.floor(rawSubtotal)
      : 0

  try {
    const payload = await getPayload({ config: configPromise })

    const evaluation = await evaluateDiscountCode({ code: body.code, payload, subtotal })

    if (!evaluation.ok) {
      // 200 + `ok: false`: a wrong code is a normal outcome of the form, not a
      // transport error, and the checkout renders `message` verbatim.
      return Response.json({ message: evaluation.message, ok: false })
    }

    return Response.json({
      amount: evaluation.amount,
      code: evaluation.code,
      ok: true,
      type: evaluation.discount.type,
      value: evaluation.discount.value,
    })
  } catch (error) {
    console.error('[discount-codes] validation failed:', error)
    return Response.json(
      { message: 'Zľavový kód sa nepodarilo overiť. Skúste to prosím znova.', ok: false },
      { status: 500 },
    )
  }
}
