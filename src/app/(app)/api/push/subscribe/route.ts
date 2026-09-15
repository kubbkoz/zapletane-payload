import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type SubscriptionBody = {
  endpoint?: unknown
  keys?: { auth?: unknown; p256dh?: unknown }
}

/**
 * POST /api/push/subscribe
 *
 * Backs the „Povoliť notifikácie" card (src/components/Pwa/PushOptIn.tsx).
 * The browser has already granted permission and produced a PushSubscription
 * by the time this is called; all this route does is remember it against the
 * logged-in account so the order-status hook can find it later.
 *
 * Upsert, not insert: a browser that re-subscribes hands back the *same*
 * endpoint, and PushOptIn re-posts on every page load to refresh `lastSeenAt`.
 * Without the upsert that would either fail on the unique index or accumulate
 * a row per visit.
 *
 * Anonymous callers get a 401. Push here exists to tell a customer about
 * *their* order, which means the subscription has to belong to an account —
 * a guest subscription would have nothing to be notified about.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return Response.json(
      { message: 'Notifikácie sú dostupné po prihlásení.', ok: false },
      { status: 401 },
    )
  }

  let body: SubscriptionBody = {}

  try {
    body = (await request.json()) as SubscriptionBody
  } catch {
    return Response.json({ message: 'Neplatná požiadavka.', ok: false }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''

  // All three are mandatory: without the keys the payload cannot be encrypted,
  // and an unencryptable subscription is a row that can never be delivered to.
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ message: 'Neúplný odber.', ok: false }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 255) || undefined

  try {
    const existing = await payload.find({
      collection: 'push-subscriptions',
      depth: 0,
      limit: 1,
      pagination: false,
      where: { endpoint: { equals: endpoint } },
    })

    const data = {
      customer: user.id,
      endpoint,
      keys: { auth, p256dh },
      lastSeenAt: new Date().toISOString(),
      userAgent,
    }

    if (existing.docs.length) {
      // The endpoint is unique across the whole collection, so a row found here
      // may belong to someone else — the same browser profile after a different
      // shopper logged in on it. Re-pointing it at the current user is exactly
      // right: the endpoint identifies the browser, and the browser is now
      // theirs. Leaving it would keep pushing the previous account's orders to
      // this device.
      const updated = await payload.update({
        collection: 'push-subscriptions',
        id: existing.docs[0]!.id,
        data,
        depth: 0,
      })

      return Response.json({ id: updated.id, ok: true })
    }

    const created = await payload.create({
      collection: 'push-subscriptions',
      data,
      depth: 0,
    })

    return Response.json({ id: created.id, ok: true }, { status: 201 })
  } catch (error) {
    console.error('[push] subscribe failed:', error)
    return Response.json({ message: 'Odber sa nepodarilo uložiť.', ok: false }, { status: 500 })
  }
}
