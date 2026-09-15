'use client'

import { Download, Share, X } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import type { BeforeInstallPromptEvent } from './support'

import { isIos, isStandalone } from './support'

const DISMISS_KEY = 'zapletane_install_dismissed_until'
const DISMISS_DAYS = 14

/**
 * A dismissal is a "not now", not a "never" — it lapses after two weeks, which
 * is long enough that the banner is not nagging and short enough that a
 * shopper who comes back a month later is offered the app again.
 *
 * Every access is wrapped: `localStorage` throws outright in a Safari private
 * window and in any context where site data is blocked, and a storage quirk
 * must not take the banner (or the page) down with it.
 */
function isDismissed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
    )
  } catch {
    // Nothing to do — the banner simply reappears next visit.
  }
}

type Mode = 'hidden' | 'ios-hint' | 'prompt'

/**
 * „Nainštalovať aplikáciu" — the install offer.
 *
 * Two shapes, because the platforms differ in kind and not in degree:
 *
 *   - Chromium (Android + desktop) fires `beforeinstallprompt`. Capturing it
 *     and calling `preventDefault()` suppresses the browser's own mini-infobar
 *     and hands the storefront a `prompt()` it can fire from a button, so the
 *     offer appears in brand styling at a moment that makes sense.
 *   - iOS Safari fires nothing and exposes no API at all: installing is a
 *     manual Share → „Pridať na plochu". All that can be done is say so, in
 *     one line, and only to iOS visitors who are not already installed.
 *
 * Firefox desktop and every other browser without the event get nothing, which
 * is correct — there is no install to offer there.
 *
 * Position is the mobile bottom bar's problem: the bar is 60px plus the safe
 * area, so below `md` the banner is lifted clear of it, and from `md` up (where
 * the bar is hidden) it sits in the bottom-right corner.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already an app: there is nothing to install, so nothing to show — on any
    // platform, and regardless of what was dismissed before.
    if (isStandalone() || isDismissed()) return

    const onBeforeInstallPrompt = (event: Event) => {
      // Always suppress the browser's own mini-infobar — but only re-open the
      // banner if the shopper has not since dismissed it. Chrome normally fires
      // this once per page load; this keeps a second firing (or a dismissal
      // stored by another tab) from undoing the "not now".
      event.preventDefault()
      if (isDismissed()) return

      setDeferred(event as BeforeInstallPromptEvent)
      setMode('prompt')
    }

    // Chrome fires `appinstalled` after a successful install from any surface
    // (including its own menu), which is the signal to stop offering.
    const onInstalled = () => {
      setMode('hidden')
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if (isIos()) setMode('ios-hint')

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    rememberDismissal()
    setMode('hidden')
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return

    // The captured event is single-use: once prompted it cannot be re-fired,
    // so it is dropped either way and the banner closes.
    setMode('hidden')

    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice

      // "Dismissed" here is the browser's own dialog being declined, which is a
      // stronger "no" than closing the banner — remember it for the full window
      // so the shopper is not asked again tomorrow.
      if (outcome === 'dismissed') rememberDismissal()
    } catch {
      // A prompt that will not open is not worth an error message.
    } finally {
      setDeferred(null)
    }
  }, [deferred])

  if (mode === 'hidden') return null

  return (
    <div
      className="fixed inset-x-4 bottom-[calc(60px_+_env(safe-area-inset-bottom)_+_12px)] z-30 md:inset-x-auto md:bottom-6 md:right-6 md:w-[22rem]"
      role="complementary"
    >
      <div className="flex items-start gap-3 rounded-default border border-brand-100 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-default bg-brand-50 text-brand"
        >
          {mode === 'ios-hint' ? <Share size={16} /> : <Download size={16} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium leading-tight text-black">
            Nainštalovať aplikáciu
          </p>

          {mode === 'ios-hint' ? (
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              V Safari: Zdieľať → Pridať na plochu
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                Zapletane na ploche — rýchlejšie otvorenie a notifikácie o objednávke.
              </p>
              <button
                className="mt-3 rounded-default bg-brand px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-600"
                onClick={install}
                type="button"
              >
                Nainštalovať
              </button>
            </>
          )}
        </div>

        <button
          aria-label="Zavrieť"
          className="-mr-1 -mt-1 shrink-0 rounded-default p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-black"
          onClick={dismiss}
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
