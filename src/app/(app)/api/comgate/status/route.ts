import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import type { Transaction } from '@/payload-types'

import { fetchComgateStatus, verifyComgateMerchant, verifyComgateSecret } from '@/payments/comgate/api'
import { COMGATE_PAYMENT_NAME } from '@/payments/comgate/constants'
import { completeComgateTransaction } from '@/payments/comgate'

export const dynamic = 'force-dynamic'

/**
 * Comgate result push (server-to-server).
 *
 * This is the ONLY place a card payment is accepted as paid: the shopper's
 * browser redirect proves nothing, so the order is created here, behind a
 * merchant + secret check, and nowhere else.
 *
 * verified(comgate-docs):
 *   - The push for a payment created via REST v2.0 is `application/json` (not
 *     form-urlencoded — that's the legacy v1.0 shape) with the fields merchant,
 *     test, price, curr, label, refId, method, email, fullName, transId, secret,
 *     status (webhooks.md "What Comgate sends"), plus documented optionals fee,
 *     vs, payerId (same field set as the GET status response, openapi
 *     `/v2.0/payment/transId/{transId}.json` schema). `readParams` below already
 *     handles both JSON and urlencoded bodies, so both shapes are covered.
 *   - `status` is one of PENDING | PAID | CANCELLED | AUTHORIZED (states.md).
 *   - the reply body content is NOT mandated — Comgate only inspects the HTTP
 *     status: any of 200/201/202/204/205 is "accepted, will not retry", anything
 *     else is retried up to ~1000 times (webhooks.md "Response contract"). The
 *     `code=0&message=OK` body kept below is harmless legacy-style shape, not a
 *     protocol requirement.
 *   - the URL this handler lives at is configured in the Comgate merchant
 *     portal ("stavová URL" / webhook URL), not sent with the payment request.
 *   - per the official handler skeleton (webhooks.md), the secret match is only
 *     step one: the handler must also re-fetch the canonical status via
 *     `GET /v2.0/payment/transId/{transId}.json` and drive every decision off
 *     THAT, never off the push body — a stolen `secret` replayed here would
 *     otherwise pass the signature check. This was previously missing and is
 *     fixed below.
 */

const okResponse = () =>
  new Response('code=0&message=OK', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    status: 200,
  })

const errorResponse = (message: string, status = 400) =>
  new Response(`code=1&message=${encodeURIComponent(message)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    status,
  })

const readParams = async (request: Request): Promise<Record<string, string>> => {
  const contentType = request.headers.get('content-type') ?? ''
  const fromQuery = Object.fromEntries(new URL(request.url).searchParams.entries())

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as Record<string, unknown>
      return {
        ...fromQuery,
        ...Object.fromEntries(
          Object.entries(body).map(([key, value]) => [key, value == null ? '' : String(value)]),
        ),
      }
    } catch {
      return fromQuery
    }
  }

  const raw = await request.text()

  return { ...fromQuery, ...Object.fromEntries(new URLSearchParams(raw).entries()) }
}

const handle = async (request: Request): Promise<Response> => {
  const params = await readParams(request)

  // Reject before touching the database — an unauthenticated public endpoint
  // should not become a way to probe for transaction IDs.
  if (!verifyComgateSecret(params.secret) || !verifyComgateMerchant(params.merchant)) {
    return errorResponse('Unauthorized', 401)
  }

  const transId = params.transId

  if (!transId) {
    return errorResponse('Missing transId')
  }

  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)

  const { docs } = await payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 1,
    req,
    where: { [`${COMGATE_PAYMENT_NAME}.transId`]: { equals: transId } },
  })

  const transaction = docs[0] as Transaction | undefined

  if (!transaction) {
    payload.logger.warn(`[comgate] Status push for unknown transId ${transId}`)
    // verified(comgate-docs): the official handler skeleton (webhooks.md) says an
    // unknown transId gets 404, not 200 — a non-2xx makes Comgate retry, which is
    // exactly the safety net we want if our own write of `transId` onto the
    // transaction (src/payments/comgate/index.ts) simply hasn't committed yet when
    // the push races ahead of it. Answering 200 here would have silently discarded a
    // real PAID push forever in that race.
    return errorResponse('Unknown transId', 404)
  }

  const pushStatus = (params.status || '').toUpperCase()

  try {
    // verified(comgate-docs): defense-in-depth re-check (webhooks.md, mandatory —
    // "Do not remove it"; security-checklist.md "MUST — Webhook"). The push body is
    // attacker-shaped even after the secret matches (a leaked secret replayed from a
    // different merchant, or a stale/forged push), so every decision below is driven
    // by this canonical read, never by `params.status` directly.
    const canonical = await fetchComgateStatus(transId)

    if (!canonical) {
      payload.logger.error(`[comgate] Canonical status re-fetch failed for transId ${transId}`)
      return errorResponse('Status verification failed', 502)
    }

    if (canonical.status !== pushStatus) {
      payload.logger.warn(
        `[comgate] transId ${transId} push status ${pushStatus || 'UNKNOWN'} != canonical ${canonical.status} — trusting canonical`,
      )
    }

    if (canonical.status === 'PAID') {
      // Re-validate the amount/currency Comgate actually processed against our own
      // transaction record before ever marking it paid. The order itself is always
      // created from `transaction.amount`/`transaction.currency` (never from
      // anything Comgate sent — see createOrderFromTransaction), so this guards
      // against fulfilling an order that was underpaid or paid in the wrong currency
      // rather than against a forged order amount.
      const expectedAmount = transaction.amount
      const expectedCurrency = transaction.currency

      const amountMismatch =
        expectedAmount != null && canonical.price != null && canonical.price !== expectedAmount
      const currencyMismatch =
        expectedCurrency != null && canonical.curr != null && canonical.curr !== expectedCurrency

      if (amountMismatch || currencyMismatch) {
        payload.logger.error(
          `[comgate] transId ${transId} amount/currency mismatch: expected ${expectedAmount} ${expectedCurrency}, canonical ${canonical.price} ${canonical.curr}`,
        )
        return errorResponse('Amount mismatch', 409)
      }

      const { created, order } = await completeComgateTransaction({ req, transaction })

      payload.logger.info(
        `[comgate] transId ${transId} PAID -> order ${order.id} (${created ? 'created' : 'already existed'})`,
      )
    } else if (canonical.status === 'CANCELLED') {
      if (!transaction.order) {
        await payload.update({
          id: transaction.id,
          collection: 'transactions',
          data: { status: 'cancelled' },
          req,
        })
      }
      payload.logger.info(`[comgate] transId ${transId} CANCELLED`)
    } else {
      // AUTHORIZED (pre-auth held, money not captured) and anything unknown leave the
      // transaction pending — a later push decides its fate.
      // verified(comgate-docs): AUTHORIZED requires an explicit capture call
      // (`POST /v2.0/preauth/capture.json`, states.md — "Capture later via the
      // pre-auth confirm endpoint, or release") to ever become PAID; it does not
      // auto-settle. This adapter never sends `preauth: true` in createComgatePayment,
      // so a standard redirect payment should never land in AUTHORIZED. If it ever
      // does (e.g. a merchant-link default outside this code's control), no automatic
      // capture is implemented here — capture/cancel are out of this integration's
      // scope — so the transaction is intentionally left pending rather than guessed
      // at; it needs a manual capture via the Client Portal or a follow-up push.
      payload.logger.info(`[comgate] transId ${transId} status ${canonical.status} — ignored`)
    }
  } catch (error) {
    payload.logger.error({ err: error }, `[comgate] Failed to process status push for ${transId}`)
    return errorResponse('Processing error', 500)
  }

  return okResponse()
}

export const POST = handle

// verified(comgate-docs): the docs (webhooks.md "What Comgate sends") only document a
// JSON POST push for REST v2.0 — no GET-based push is described anywhere in
// api-overview.md, webhooks.md or the openapi spec. This remains an open question (see
// report) rather than a confirmed requirement; accepting GET costs nothing here since
// `readParams` reads the same fields from the query string and the secret/canonical
// re-check gates it identically, so it is kept as a harmless accommodation rather than
// removed on a guess either way.
export const GET = handle
