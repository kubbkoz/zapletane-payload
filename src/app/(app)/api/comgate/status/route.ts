import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import type { Transaction } from '@/payload-types'

import { verifyComgateMerchant, verifyComgateSecret } from '@/payments/comgate/api'
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
 * TODO-VERIFY(comgate): the docs site is egress-blocked in this environment, so
 * the following are reconstructed and must be confirmed before going live:
 *   - Comgate POSTs `application/x-www-form-urlencoded` with the fields
 *     merchant, test, price, curr, label, refId, method, email, transId,
 *     secret, status (and optionally fee, vs, payerId).
 *   - `status` is one of PAID | CANCELLED | AUTHORIZED.
 *   - a successful handler must answer with the plain body `code=0&message=OK`.
 *   - the URL this handler lives at is configured in the Comgate merchant
 *     portal ("stavová URL"), not sent with the payment request.
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
    // Answer 200 anyway: Comgate retries on a non-OK reply, and no amount of
    // retrying will make a transaction we never created appear.
    return okResponse()
  }

  const status = (params.status || '').toUpperCase()

  try {
    if (status === 'PAID') {
      const { created, order } = await completeComgateTransaction({ req, transaction })

      payload.logger.info(
        `[comgate] transId ${transId} PAID -> order ${order.id} (${created ? 'created' : 'already existed'})`,
      )
    } else if (status === 'CANCELLED') {
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
      // AUTHORIZED (pre-auth held, money not captured) and anything unknown
      // leave the transaction pending — a later push decides its fate.
      // TODO-VERIFY(comgate): whether AUTHORIZED ever needs an explicit capture
      // call for this merchant contract.
      payload.logger.info(`[comgate] transId ${transId} status ${status || 'UNKNOWN'} — ignored`)
    }
  } catch (error) {
    payload.logger.error({ err: error }, `[comgate] Failed to process status push for ${transId}`)
    return errorResponse('Processing error', 500)
  }

  return okResponse()
}

export const POST = handle

// TODO-VERIFY(comgate): some Comgate setups probe the status URL with GET.
// Accepting it costs nothing — the secret check is identical.
export const GET = handle
