/**
 * Browser-capability probes shared by the PWA components.
 *
 * Every one of these touches `window`/`navigator`, so they must only ever run
 * inside an effect or an event handler — never during render, or the server
 * and the first client paint disagree and React throws a hydration mismatch.
 */

/** Is the page already running as an installed app rather than in a browser tab? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false

  // `navigator.standalone` is the iOS-only legacy signal — Safari still does
  // not report `display-mode: standalone` reliably for home-screen apps.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone

  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true
}

/**
 * iOS/iPadOS detection.
 *
 * Deliberately UA-sniffing, because the thing being detected *is* a
 * platform-specific gap: iOS fires no `beforeinstallprompt` (install is a
 * manual Share-sheet action) and refuses Web Push entirely until the site has
 * been added to the home screen. There is no feature test for "the browser
 * will let you install, but only by hand".
 *
 * iPadOS ≥13 reports itself as "Macintosh", so the touch-point count is what
 * separates an iPad from a desktop Mac.
 */
export function isIos(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent

  if (/iPad|iPhone|iPod/.test(ua)) return true

  return ua.includes('Macintosh') && navigator.maxTouchPoints > 1
}

/** Does this browser have everything Web Push needs? */
export function supportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * `applicationServerKey` must be the raw bytes of the VAPID public key, but the
 * key travels as URL-safe base64 (that is the form `web-push` prints and the
 * form stored in the environment), so it is decoded here.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)

  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)

  return output
}

/**
 * The `beforeinstallprompt` event, which no lib.dom version types.
 *
 * Chromium-only: the browser fires it *instead of* showing its own install
 * affordance once `preventDefault()` is called, which is what lets the
 * storefront put the offer where it belongs.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
