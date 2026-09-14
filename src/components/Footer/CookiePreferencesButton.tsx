'use client'

import React from 'react'

/**
 * "Nastavenia cookies" in the footer's bottom bar.
 *
 * The Nuxt original called `$cc?.showPreferences()` (vanilla-cookieconsent),
 * which this port does not ship yet. Rather than render a dead control or drop
 * the row, the button dispatches a documented DOM event — whatever consent
 * layer lands later listens for it and opens its own preferences dialog, with
 * no change needed here.
 */
export const COOKIE_PREFERENCES_EVENT = 'zapletane:cookie-preferences'

export function CookiePreferencesButton() {
  return (
    <button
      className="cursor-pointer border-none bg-transparent p-0 text-[10px] font-normal uppercase tracking-wider text-white/55 transition-colors hover:text-white/80"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))
      }}
      type="button"
    >
      Nastavenia cookies
    </button>
  )
}
