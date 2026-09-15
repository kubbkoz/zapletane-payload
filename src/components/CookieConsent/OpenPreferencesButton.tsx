'use client'

import React from 'react'

import { openCookiePreferences } from './consent'

type Props = {
  children?: React.ReactNode
  className?: string
  /** Visible text when no `children` are passed. */
  label?: string
}

/**
 * „Nastavenia cookies" — the single way back into the consent dialog once the
 * banner has been dismissed, which is what makes the consent withdrawable (and
 * therefore lawful) rather than a one-shot click.
 *
 * Unstyled on purpose: the footer wants a 10px uppercase link, the push card
 * wants a brand button. Both pass their own `className`.
 *
 * Not wired through the plugin's `data-cc="show-preferencesModal"` attribute —
 * that is only scanned once, when `run()` executes, so it would miss any
 * button React mounts later.
 */
export function OpenPreferencesButton({ children, className, label = 'Nastavenia cookies' }: Props) {
  return (
    <button className={className} onClick={() => openCookiePreferences()} type="button">
      {children ?? label}
    </button>
  )
}

export default OpenPreferencesButton
