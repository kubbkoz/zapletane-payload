// ZAPLETANE service worker.
//
// Two jobs, and deliberately no third:
//   1. satisfy PWA installability (Chrome only offers "Add to Home Screen"
//      once an activated SW with a fetch handler is controlling the page), and
//   2. receive Web Push and open the right page when the customer taps it.
//
// It deliberately does NOT cache anything — this app has already been bitten
// once by a stale-cache bug (a single transient 500 got cached and replayed
// for an hour). A caching SW here would reintroduce that exact class of risk.
// Every request just passes straight through to the network.

const FALLBACK_TITLE = 'ZAPLETANE'
const FALLBACK_ICON = '/icon-192.png'
const BADGE_ICON = '/icon-badge-96.png'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Range requests (video seeking/streaming) must stay on the browser's native path —
  // re-issuing them via fetch() strips Range semantics and breaks playback on Chrome.
  if (event.request.headers.has('range')) return
  event.respondWith(fetch(event.request))
})

/**
 * Push payloads are produced by src/push/send.ts and are always JSON:
 *   { title, body, url, tag?, icon? }
 * A push with no payload (or an unparseable one) still has to show *something*:
 * every major browser terminates the SW and shows its own generic "This site
 * has been updated in the background" notification if the push event ends
 * without a notification, so the fallback below is what keeps that from
 * happening.
 */
self.addEventListener('push', (event) => {
  let payload = {}

  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { body: event.data.text() }
    }
  }

  const title = payload.title || FALLBACK_TITLE
  const url = typeof payload.url === 'string' && payload.url ? payload.url : '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: BADGE_ICON,
      body: payload.body || '',
      // `tag` collapses repeat notifications about the same subject (e.g. two
      // status changes on one order) into a single entry instead of stacking.
      tag: payload.tag || url,
      icon: payload.icon || FALLBACK_ICON,
      // The click handler below needs the destination, and `data` is the only
      // part of a notification that survives to the notificationclick event.
      data: { url },
      lang: 'sk',
      renotify: Boolean(payload.tag),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = (event.notification.data && event.notification.data.url) || '/'
  const absolute = new URL(target, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Prefer reusing a tab that is already on the target page, then any open
      // tab of this origin (navigated to the target), and only open a new
      // window as a last resort — otherwise every tapped notification leaves
      // another orphaned tab behind.
      for (const client of clients) {
        if (client.url === absolute && 'focus' in client) return client.focus()
      }

      for (const client of clients) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(absolute).then((navigated) => (navigated || client).focus())
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(absolute)
    }),
  )
})
