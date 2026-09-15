'use client'

import React from 'react'

import { OpenPreferencesButton } from '@/components/CookieConsent/OpenPreferencesButton'
import { COOKIE_PREFERENCES_EVENT } from '@/components/CookieConsent/consent'

/**
 * "Nastavenia cookies" in the footer's bottom bar.
 *
 * The Nuxt original called `$cc?.showPreferences()` (vanilla-cookieconsent);
 * this now does the same thing through
 * `src/components/CookieConsent/OpenPreferencesButton`, keeping the footer's
 * own typography.
 *
 * The event constant is re-exported from its new home so the documented
 * `window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))` contract
 * (which the banner still listens for) keeps resolving from this path.
 */
export { COOKIE_PREFERENCES_EVENT }

type Props = {
  /** Editable in the `footer` global; defaults to the original label. */
  label?: string
}

export function CookiePreferencesButton({ label = 'Nastavenia cookies' }: Props) {
  return (
    <OpenPreferencesButton
      className="cursor-pointer border-none bg-transparent p-0 text-[10px] font-normal uppercase tracking-wider text-white/55 transition-colors hover:text-white/80"
      label={label}
    />
  )
}
