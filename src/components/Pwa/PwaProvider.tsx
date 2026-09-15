'use client'

import React, { useEffect } from 'react'

import { InstallPrompt } from './InstallPrompt'

/**
 * Mounts the PWA layer: registers the service worker and renders the install
 * offer. Nothing else is visual — the push opt-in (`PushOptIn`) is placed by
 * whichever page wants it, because a permission-adjacent card belongs on the
 * account screen, not floating over the whole site.
 *
 * Registration is deliberately *not* delayed behind `load`. The worker does no
 * caching and no precaching, so there is no bandwidth to contend with, and
 * registering immediately means `navigator.serviceWorker.ready` resolves by
 * the time a shopper can reach the opt-in button.
 */
export function PwaProvider() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // The dev server re-serves /sw.js on every change; registration is
    // idempotent, so this is safe to run on every mount.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // A blocked or unavailable service worker costs the shopper the install
      // offer and push, nothing more — the storefront works without it, so
      // this is logged rather than surfaced.
      console.error('[pwa] service worker registration failed:', error)
    })
  }, [])

  return <InstallPrompt />
}
