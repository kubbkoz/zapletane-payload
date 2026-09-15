import type { Payload } from 'payload'

/**
 * What a push actually carries. Kept deliberately small and generic — the
 * service worker (public/sw.js) reads exactly these keys, so any future
 * notification kind (reklamácia, vrátenie tovaru, doručenie zásielky) is a new
 * caller, not a new payload shape.
 */
export type PushNotification = {
  /** Notification headline, e.g. „Objednávka č. 42“. */
  title: string
  /** One line of detail, e.g. „Stav sa zmenil: Doručená“. */
  body: string
  /** Where tapping the notification takes the customer. Relative to the site root. */
  url?: string
  /**
   * Collapse key. Two notifications sharing a tag replace each other instead of
   * stacking — so three status changes on one order leave one entry, not three.
   * Defaults to `url` inside the service worker.
   */
  tag?: string
}

export type SendPushResult = {
  /** Subscriptions the push service accepted. */
  sent: number
  /** Subscriptions that failed for a reason other than being gone. */
  failed: number
  /** Dead subscriptions deleted as a result of this send. */
  pruned: number
  /** True when nothing was attempted because VAPID is not configured. */
  skipped: boolean
}

type VapidDetails = {
  subject: string
  publicKey: string
  privateKey: string
}

/**
 * Push services keep an undeliverable message for this long before dropping it.
 * Six hours: long enough to survive a phone being off overnight-ish, short
 * enough that a customer never gets told about a status change that has since
 * been superseded twice.
 */
const TTL_SECONDS = 6 * 60 * 60

/** Guard rail: a single customer should never have hundreds of live browsers. */
const MAX_SUBSCRIPTIONS_PER_CUSTOMER = 50

let vapidCache: undefined | VapidDetails | null
let warnedAboutMissingVapid = false

type WebPushModule = typeof import('web-push')

let webPushModule: Promise<WebPushModule> | undefined

/**
 * Load `web-push` lazily, and tolerate both module shapes.
 *
 * `web-push` is CommonJS (`module.exports = { … }` built from bound methods),
 * which Node's ESM loader cannot statically analyse into named exports — a
 * top-level `import { sendNotification } from 'web-push'` throws
 * "does not provide an export named …" as soon as this file is loaded outside
 * a bundler, which is exactly what `payload migrate` and the Payload CLI do.
 * A dynamic import with a `default` fallback works under Node ESM, under
 * webpack and under Turbopack alike.
 *
 * Lazy also keeps the library (and its crypto setup) out of the import graph
 * of every `next build` and admin bundle that merely touches the orders
 * collection config.
 */
function loadWebPush(): Promise<WebPushModule> {
  if (!webPushModule) {
    webPushModule = import('web-push').then((mod) => {
      const candidate = (mod as { default?: WebPushModule }).default

      return candidate && typeof candidate.sendNotification === 'function'
        ? candidate
        : (mod as WebPushModule)
    })
  }

  return webPushModule
}

/**
 * Read VAPID config from the environment — lazily, and once.
 *
 * Lazily because this module is imported by the orders collection hook, which
 * is imported by the Payload config, which is imported by `next build`,
 * `payload migrate` and the admin bundle. Reading (or worse, validating) env at
 * module scope would turn "keys not set yet" into a build failure. Missing keys
 * must degrade to "no push", never to a crash.
 */
function getVapidDetails(): null | VapidDetails {
  if (vapidCache !== undefined) return vapidCache

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@zapletane.sk'

  if (!publicKey || !privateKey) {
    vapidCache = null
    return null
  }

  vapidCache = { privateKey, publicKey, subject }
  return vapidCache
}

function warnMissingVapidOnce(): void {
  if (warnedAboutMissingVapid) return
  warnedAboutMissingVapid = true
  console.warn(
    '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push notifications are disabled. ' +
      'Generate a pair with `npx web-push generate-vapid-keys` and set them (plus NEXT_PUBLIC_VAPID_PUBLIC_KEY) in the environment.',
  )
}

/**
 * A subscription the push service says no longer exists.
 *
 * 404 Not Found / 410 Gone is the standard way a push service reports that the
 * browser uninstalled the app, cleared site data, or revoked permission. Those
 * rows are garbage forever, so they are deleted rather than retried — otherwise
 * every future send pays for them again.
 *
 * Duck-typed on `statusCode` rather than `instanceof WebPushError`: the class
 * is loaded through a dynamic import that different bundlers may resolve to
 * different module instances, and an `instanceof` that silently returns false
 * would quietly stop the pruning from ever happening.
 */
function isGone(error: unknown): boolean {
  const statusCode = (error as { statusCode?: unknown })?.statusCode

  return statusCode === 404 || statusCode === 410
}

/**
 * Send one notification to every browser a customer has opted in from.
 *
 * Generic on purpose: callers supply the copy. Today the only wired caller is
 * the order-status hook (src/push/notifyOrderStatus.ts); reklamácie and
 * returns will be additional callers, not additional code here.
 *
 * Never throws. A push is a courtesy on top of whatever operation triggered it
 * — an order must still save when a push service is down — so every failure is
 * logged and folded into the returned counters instead.
 */
export async function sendPushToCustomer(
  payload: Payload,
  customerId: number | string,
  notification: PushNotification,
): Promise<SendPushResult> {
  const result: SendPushResult = { failed: 0, pruned: 0, sent: 0, skipped: false }

  const vapidDetails = getVapidDetails()

  if (!vapidDetails) {
    warnMissingVapidOnce()
    return { ...result, skipped: true }
  }

  let subscriptions

  try {
    // overrideAccess stays at its default (true): this runs from a hook or a
    // trusted server route with no `req.user` of its own, and the customer is
    // already pinned by the caller.
    const found = await payload.find({
      collection: 'push-subscriptions',
      depth: 0,
      limit: MAX_SUBSCRIPTIONS_PER_CUSTOMER,
      pagination: false,
      where: { customer: { equals: customerId } },
    })

    subscriptions = found.docs
  } catch (error) {
    console.error('[push] could not load subscriptions for customer', customerId, error)
    return { ...result, failed: 1 }
  }

  if (!subscriptions.length) return result

  const { sendNotification } = await loadWebPush()

  const body = JSON.stringify(notification)
  const goneIds: (number | string)[] = []

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.keys?.auth ?? '',
              p256dh: subscription.keys?.p256dh ?? '',
            },
          },
          body,
          { TTL: TTL_SECONDS, vapidDetails },
        )
        result.sent += 1
      } catch (error) {
        if (isGone(error)) {
          goneIds.push(subscription.id)
          return
        }

        result.failed += 1
        console.error('[push] send failed for subscription', subscription.id, error)
      }
    }),
  )

  if (goneIds.length) {
    try {
      await payload.delete({
        collection: 'push-subscriptions',
        where: { id: { in: goneIds } },
      })
      result.pruned = goneIds.length
    } catch (error) {
      console.error('[push] could not prune expired subscriptions', goneIds, error)
    }
  }

  return result
}
