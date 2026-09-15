import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/**
 * POST (or DELETE) /api/push/unsubscribe  { endpoint }
 *
 * The other half of „Vypnúť notifikácie". The browser drops its own
 * subscription via `PushSubscription.unsubscribe()`; this removes the row so
 * the server stops trying to reach a device that will no longer accept it.
 *
 * Owner-scoped: an endpoint is deleted only when it belongs to the caller
 * (admins may delete any). Endpoint strings are long and unguessable, but they
 * do travel in a request body, so ownership is re-checked here rather than
 * trusted.
 *
 * Deleting an endpoint that is already gone is a success, not a 404 — the
 * caller asked for it to not exist, and it does not exist.
 */
async function removeSubscription(request: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return Response.json({ message: 'Vyžaduje sa prihlásenie.', ok: false }, { status: 401 })
  }

  let endpoint = ''

  try {
    const body = (await request.json()) as { endpoint?: unknown }
    endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  } catch {
    // DELETE may legitimately carry no body — fall back to the query string.
    endpoint = new URL(request.url).searchParams.get('endpoint')?.trim() || ''
  }

  if (!endpoint) {
    return Response.json({ message: 'Chýba endpoint.', ok: false }, { status: 400 })
  }

  try {
    const deleted = await payload.delete({
      collection: 'push-subscriptions',
      depth: 0,
      // `overrideAccess: false` + `user` runs the collection's own
      // `isDocumentOwner` access control, so the `customer` narrowing is
      // applied by Payload rather than duplicated here.
      overrideAccess: false,
      user,
      where: { endpoint: { equals: endpoint } },
    })

    return Response.json({ ok: true, removed: deleted.docs.length })
  } catch (error) {
    console.error('[push] unsubscribe failed:', error)
    return Response.json({ message: 'Odber sa nepodarilo zrušiť.', ok: false }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<Response> {
  return removeSubscription(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return removeSubscription(request)
}
