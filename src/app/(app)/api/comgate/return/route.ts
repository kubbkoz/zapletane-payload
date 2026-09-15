import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import type { Order, Transaction } from '@/payload-types'

import { fetchComgateStatus } from '@/payments/comgate/api'
import { completeComgateTransaction } from '@/payments/comgate'
import { COMGATE_PAYMENT_NAME } from '@/payments/comgate/constants'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

/**
 * Where the shopper's browser lands after leaving the Comgate gateway.
 *
 * This route decides which page to show — it is NOT how a payment is accepted.
 * The authoritative signal is the server-to-server push at /api/comgate/status;
 * anything arriving here is attacker-controlled. The one concession is a
 * *server-initiated* status lookup against Comgate (same credentials as the
 * status push) so the shopper is not left staring at "pending" when the push is
 * merely slow.
 *
 * verified(comgate-docs): the redirect-back URLs receive `transId` and `refId`
 * as GET params (api-overview.md "Redirect after payment (browser-facing)");
 * `id` is not a documented param name and is kept only as defensive extra
 * leniency, never relied on alone. Comgate does support three separate
 * per-outcome URLs (success/pending/cancelled), configurable either as Portal
 * defaults or per-payment via url_paid/url_cancelled/url_pending — this
 * adapter now sends all three as this same route (see createComgatePayment in
 * src/payments/comgate/api.ts) so every outcome lands here regardless of
 * Portal configuration, and the branching below (not the URL picked) decides
 * what the shopper sees.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const base = getServerSideURL()

  const transId = url.searchParams.get('transId') || url.searchParams.get('id')
  const refId = url.searchParams.get('refId')

  const redirect = (path: string) => Response.redirect(`${base}${path}`, 303)

  if (!transId && !refId) {
    return redirect('/checkout')
  }

  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)

  const { docs } = await payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 1,
    req,
    where: transId
      ? { [`${COMGATE_PAYMENT_NAME}.transId`]: { equals: transId } }
      : { [`${COMGATE_PAYMENT_NAME}.refId`]: { equals: refId } },
  })

  const transaction = docs[0] as Transaction | undefined

  if (!transaction) {
    return redirect('/checkout')
  }

  let orderID = transaction.order
    ? typeof transaction.order === 'object'
      ? transaction.order.id
      : transaction.order
    : null

  // The push may not have landed yet. Ask Comgate directly rather than trusting
  // whatever the browser carried back.
  if (!orderID && transId) {
    const canonical = await fetchComgateStatus(transId)

    if (canonical?.status === 'PAID') {
      try {
        const { order } = await completeComgateTransaction({ req, transaction })
        orderID = order.id
      } catch (error) {
        payload.logger.error({ err: error }, `[comgate] Return-path completion failed for ${transId}`)
      }
    } else if (canonical?.status === 'CANCELLED') {
      return redirect('/checkout?platba=zrusena')
    }
  }

  if (!orderID) {
    // Paid-but-not-yet-confirmed: the confirm-order page polls and the status
    // push will catch up within seconds.
    return redirect('/checkout?platba=spracuva-sa')
  }

  const order = (await payload.findByID({
    collection: 'orders',
    id: orderID,
    depth: 0,
    req,
  })) as Order

  const query = new URLSearchParams()

  if (order.customerEmail) {
    query.set('email', order.customerEmail)
  }
  if (order.accessToken) {
    query.set('accessToken', order.accessToken)
  }

  const queryString = query.toString()

  return redirect(`/orders/${order.id}${queryString ? `?${queryString}` : ''}`)
}
