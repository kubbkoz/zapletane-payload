/**
 * The consent API for the rest of the app.
 *
 * Nothing outside `src/components/CookieConsent/` talks to
 * `vanilla-cookieconsent` directly: components ask this module whether a
 * category is granted, and subscribe here to be told when that changes. The
 * banner (`index.client.tsx`) is the only writer — it publishes every consent
 * action as a `zap:consentchange` event on `window`.
 *
 * Two readers, in this order:
 *
 *   1. `window.CookieConsent` — the real plugin API, which the banner exposes
 *      once `run()` has resolved (the ESM build does not attach itself to
 *      `window`, unlike the UMD one, so the banner does it deliberately).
 *   2. the plugin's own `cc_cookie`, parsed by hand. This covers the sliver of
 *      time between first paint and the plugin finishing its dynamic import —
 *      without it, a component mounting in that window would read "not
 *      consented" for a shopper who consented months ago and would, for
 *      example, tear down a perfectly good push subscription.
 *
 * Every function is safe on the server: there is no consent on the server (the
 * cookie is not read during SSR), so they answer `false` / no-op rather than
 * touching `window`.
 */

/** The categories declared in the banner config. `necessary` is always on. */
export type ConsentCategory = 'analytics' | 'functional' | 'necessary'

/** The optional categories, as broadcast with every change. */
export type ConsentState = {
  analytics: boolean
  functional: boolean
}

/** Fired on `window` after every consent action (and once per page load). */
export const CONSENT_CHANGE_EVENT = 'zap:consentchange'

/**
 * Legacy inbound contract: dispatching this on `window` opens the preferences
 * dialog. It predates this module (the footer button shipped before the
 * consent layer existed) and is kept so anything already wired to it keeps
 * working; new code calls `openCookiePreferences()` instead.
 */
export const COOKIE_PREFERENCES_EVENT = 'zapletane:cookie-preferences'

/** Plugin cookie name — the default, kept explicit because we parse it here. */
export const CONSENT_COOKIE_NAME = 'cc_cookie'

declare global {
  interface WindowEventMap {
    [CONSENT_CHANGE_EVENT]: CustomEvent<ConsentState>
  }
}

/** Categories stored in `cc_cookie`, or `[]` when there is no valid consent. */
function readCategoriesFromCookie(): string[] {
  try {
    const match = document.cookie.match(`(^|;)\\s*${CONSENT_COOKIE_NAME}\\s*=\\s*([^;]+)`)

    if (!match) return []

    const parsed = JSON.parse(decodeURIComponent(match.pop() as string)) as {
      categories?: string[]
    }

    return Array.isArray(parsed.categories) ? parsed.categories : []
  } catch {
    // Malformed / unreadable cookie is treated as "no consent given" — the
    // safe direction for a GDPR gate.
    return []
  }
}

/**
 * Has the shopper accepted this category?
 *
 * `necessary` is read-only in the config and therefore always granted; asking
 * about it is allowed so callers can stay category-agnostic.
 */
export function isConsentAccepted(category: ConsentCategory): boolean {
  if (typeof window === 'undefined') return false
  if (category === 'necessary') return true

  const plugin = window.CookieConsent

  if (plugin && typeof plugin.acceptedCategory === 'function') {
    return plugin.acceptedCategory(category)
  }

  return readCategoriesFromCookie().includes(category)
}

/** Both optional categories in one object — the shape of the change event. */
export function getConsentState(): ConsentState {
  return {
    analytics: isConsentAccepted('analytics'),
    functional: isConsentAccepted('functional'),
  }
}

/**
 * Subscribe to consent changes. Returns the unsubscribe function, so an effect
 * can `return onConsentChange(…)` directly.
 *
 * The callback also runs for the "consent already on file" event the banner
 * publishes on every page load, so a subscriber never has to poll.
 */
export function onConsentChange(callback: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ConsentState>).detail

    callback(detail ?? getConsentState())
  }

  window.addEventListener(CONSENT_CHANGE_EVENT, handler)

  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler)
}

/** Banner-only: broadcast the current state to every subscriber. */
export function publishConsentChange(state: ConsentState): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }))
}

/**
 * Open the preferences dialog — the „možnosť nastaviť povolenia" entry point.
 *
 * The plugin is normally already loaded (the banner mounts in the root
 * layout); the dynamic import is the fallback for a click that lands in the
 * first few hundred milliseconds. Both paths resolve to the same module
 * instance, so the second one drives the very same dialog.
 */
export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return

  const plugin = window.CookieConsent

  if (plugin && typeof plugin.showPreferences === 'function') {
    plugin.showPreferences()
    return
  }

  void import('vanilla-cookieconsent')
    .then((module) => module.showPreferences())
    .catch(() => {
      // Nothing to open — the plugin could not load at all. Silent by design:
      // a failed cookie dialog must not throw in a click handler.
    })
}
