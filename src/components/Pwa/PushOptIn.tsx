'use client'

import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { OpenPreferencesButton } from '@/components/CookieConsent/OpenPreferencesButton'
import { isConsentAccepted, onConsentChange } from '@/components/CookieConsent/consent'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'

import { isIos, isStandalone, supportsPush, urlBase64ToUint8Array } from './support'

/**
 * - `loading`      — capabilities not probed yet (first render, server included).
 * - `unsupported`  — no Push API, or no VAPID key configured. Renders nothing.
 * - `ios-install`  — iOS, not installed: Web Push is unreachable until it is.
 * - `signed-out`   — push is tied to an account, so there is nothing to notify about yet.
 * - `needs-consent`— the `functional` cookie category has not been granted.
 * - `idle`         — everything is ready and the shopper has not decided.
 * - `busy`         — a permission prompt / subscribe round-trip is in flight.
 * - `enabled`      — granted *and* a subscription is stored server-side.
 * - `denied`       — the browser is blocking; only browser settings can undo it.
 * - `error`        — granted, but the subscription could not be saved.
 */
type State =
  | 'busy'
  | 'denied'
  | 'enabled'
  | 'error'
  | 'idle'
  | 'ios-install'
  | 'loading'
  | 'needs-consent'
  | 'signed-out'
  | 'unsupported'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  // Idempotent: registering an already-registered script resolves with the
  // existing registration. Done here as well as in PwaProvider so this card
  // still works if it is ever rendered on a page that provider does not cover.
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

/**
 * Drop the browser subscription and the row that backs it.
 *
 * Shared by the explicit „Vypnúť notifikácie" button and by the silent
 * teardown that runs when `functional` consent has been withdrawn — the same
 * order in both cases (server first, so a surviving row can never outlive the
 * endpoint it points at).
 */
async function teardownSubscription(): Promise<void> {
  const registration = await readyRegistration()
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) return

  await fetch('/api/push/unsubscribe', {
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }).catch(() => {})

  await subscription.unsubscribe()
}

type Props = {
  className?: string
  /**
   * `card` — standalone bordered card (default).
   * `inline` — no border or background, for embedding inside an existing
   *   account panel that already provides the surface.
   */
  variant?: 'card' | 'inline'
}

/**
 * „Povoliť notifikácie" — the push opt-in.
 *
 * The permission prompt is fired **only** from the button's own click handler.
 * Never on mount, never on scroll: a notification permission prompt that
 * appears unasked is the fastest way to get permanently blocked, and Chrome
 * will eventually suppress the prompt entirely for a site that does it.
 *
 * On mount the component only *reads* state that costs nothing — the existing
 * `Notification.permission` value and any subscription the browser already
 * holds — and refreshes `lastSeenAt` server-side when both are already in
 * place, so the admin can tell live browsers from abandoned ones.
 *
 * CONSENT
 * Push sits in the `functional` cookie category. Without it the card shows the
 * way into the cookie dialog instead of the CTA, the permission prompt is
 * unreachable, and an existing subscription is torn down on the next page load
 * (see the `needs-consent` branch of the probe). Granting or withdrawing the
 * category swaps the card over live, through `onConsentChange` — no reload.
 */
export function PushOptIn({ className, variant = 'card' }: Props) {
  const { user } = useAuth()
  const [state, setState] = useState<State>('loading')

  // Push notifications live in the `functional` cookie category, so nothing
  // here may touch `Notification.requestPermission()` before that is granted.
  //
  // The initialiser runs on the client's first render (the server always says
  // `false`, and renders nothing either way, so there is no hydration
  // mismatch). It has to be read that early rather than in an effect: starting
  // at `false` would make the probe below mistake "not known yet" for
  // "withdrawn" and tear down a perfectly good subscription.
  const [functionalConsent, setFunctionalConsent] = useState(() =>
    isConsentAccepted('functional'),
  )

  useEffect(() => {
    // Re-read once mounted, in case the consent plugin finished loading
    // between render and effect, then follow every later change — this is what
    // swaps the card over without a reload when the shopper flips the toggle.
    setFunctionalConsent(isConsentAccepted('functional'))

    return onConsentChange(({ functional }) => setFunctionalConsent(functional))
  }, [])

  useEffect(() => {
    let cancelled = false

    const probe = async () => {
      if (!supportsPush() || !VAPID_PUBLIC_KEY) return setState('unsupported')

      // iOS gates the whole Push API behind being installed to the home
      // screen: `Notification.requestPermission()` in Safari's browser tab
      // resolves 'denied' without ever asking. Saying so is more useful than
      // offering a button that cannot work.
      if (isIos() && !isStandalone()) return setState('ios-install')

      // `undefined` means the /api/users/me round-trip is still in flight.
      if (user === undefined) return
      if (!user) return setState('signed-out')

      // Consent withdrawn (or never given): offer the way back into the cookie
      // dialog, and quietly undo any subscription that is still live — a
      // withdrawal has to stop the notifications actually arriving, not just
      // hide the button. Best effort and silent: the shopper asked for less
      // tracking, not for an error message.
      if (!functionalConsent) {
        void teardownSubscription().catch(() => {})

        return setState('needs-consent')
      }

      if (Notification.permission === 'denied') return setState('denied')
      if (Notification.permission !== 'granted') return setState('idle')

      try {
        const registration = await readyRegistration()
        const subscription = await registration.pushManager.getSubscription()

        if (cancelled) return

        if (!subscription) return setState('idle')

        setState('enabled')

        // Quiet keep-alive. The route upserts on `endpoint`, so this only
        // refreshes `lastSeenAt` (and re-points the row if a different account
        // is now signed in on this browser).
        void fetch('/api/push/subscribe', {
          body: JSON.stringify(subscription.toJSON()),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }).catch(() => {})
      } catch {
        if (!cancelled) setState('idle')
      }
    }

    void probe()

    return () => {
      cancelled = true
    }
  }, [functionalConsent, user])

  const enable = useCallback(async () => {
    // Belt and braces: the CTA is not rendered without consent, but the
    // permission prompt must never be reachable without it.
    if (!isConsentAccepted('functional')) return setState('needs-consent')

    setState('busy')

    try {
      const permission = await Notification.requestPermission()

      if (permission === 'denied') return setState('denied')
      if (permission !== 'granted') return setState('idle')

      const registration = await readyRegistration()

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
          // Mandatory in Chrome: it is the promise that every push results in a
          // visible notification. Silent pushes are not on offer.
          userVisibleOnly: true,
        }))

      const response = await fetch('/api/push/subscribe', {
        body: JSON.stringify(subscription.toJSON()),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      if (!response.ok) {
        // The browser would keep delivering to a subscription the server does
        // not know about, so it is torn down rather than left dangling.
        await subscription.unsubscribe().catch(() => {})
        return setState(response.status === 401 ? 'signed-out' : 'error')
      }

      setState('enabled')
    } catch (error) {
      console.error('[push] could not enable notifications:', error)
      setState('error')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('busy')

    try {
      // Server first: if the row survived while the browser subscription did
      // not, every later send would waste a request on a dead endpoint.
      await teardownSubscription()

      setState('idle')
    } catch (error) {
      console.error('[push] could not disable notifications:', error)
      setState('enabled')
    }
  }, [])

  if (state === 'loading' || state === 'unsupported') return null

  const wrapper = cn(
    variant === 'card' && 'rounded-default border border-brand-100 bg-white p-4',
    'flex items-start gap-3',
    className,
  )

  const icon = (glyph: React.ReactNode) => (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-default bg-brand-50 text-brand"
    >
      {glyph}
    </span>
  )

  if (state === 'ios-install') {
    return (
      <div className={wrapper}>
        {icon(<Bell size={16} />)}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Notifikácie o objednávke
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Na iPhone a iPade fungujú notifikácie až po pridaní stránky na plochu: Zdieľať → Pridať
            na plochu.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'signed-out') {
    return (
      <div className={wrapper}>
        {icon(<Bell size={16} />)}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Notifikácie o objednávke
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Dostupné po{' '}
            <Link className="underline underline-offset-2 hover:text-brand" href="/login">
              prihlásení
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  if (state === 'needs-consent') {
    return (
      <div className={wrapper}>
        {icon(<BellOff size={16} />)}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Notifikácie o objednávke
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Najprv povoľte funkčné cookies.
          </p>
          <OpenPreferencesButton className="mt-3 rounded-default bg-brand px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-600">
            Nastavenia cookies
          </OpenPreferencesButton>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={wrapper}>
        {icon(<BellOff size={16} />)}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Notifikácie sú zablokované
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Povoľte ich v nastaveniach prehliadača pre túto stránku (ikona vedľa adresy →
            Notifikácie).
          </p>
        </div>
      </div>
    )
  }

  if (state === 'enabled') {
    return (
      <div className={wrapper}>
        {icon(<BellRing size={16} />)}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Notifikácie zapnuté
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Ozveme sa, keď sa zmení stav vašej objednávky.
          </p>
          <button
            className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 underline underline-offset-4 transition-colors hover:text-black"
            onClick={disable}
            type="button"
          >
            Vypnúť notifikácie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapper}>
      {icon(state === 'busy' ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />)}
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-medium leading-tight text-black">
          Notifikácie o objednávke
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          {state === 'error'
            ? 'Notifikácie sa nepodarilo zapnúť. Skúste to prosím znova.'
            : 'Upozorníme vás, keď sa zmení stav vašej objednávky.'}
        </p>
        <button
          className="mt-3 rounded-default bg-brand px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          disabled={state === 'busy'}
          onClick={enable}
          type="button"
        >
          {state === 'busy' ? 'Moment…' : 'Povoliť notifikácie'}
        </button>
      </div>
    </div>
  )
}

/**
 * Borderless variant for embedding in a panel that already draws its own
 * surface — e.g. a „Nastavenia účtu" section on /account.
 */
export function PushOptInInline({ className }: { className?: string }) {
  return <PushOptIn className={className} variant="inline" />
}
