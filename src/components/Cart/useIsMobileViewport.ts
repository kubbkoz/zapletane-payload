'use client'

import { useEffect, useState } from 'react'

/** `md` — kept in sync with `--breakpoint-md: 48rem` in globals.css. */
const MOBILE_QUERY = '(max-width: 47.99rem)'

/**
 * Is the viewport below `md`? SSR-safe by construction: it reports `false`
 * until the first client effect runs, so the server render and the hydrating
 * client render are byte-identical and React never warns.
 *
 * That "false until mounted" default is also why the cart drawer cannot flash
 * the wrong side on first paint: Radix only mounts the sheet's content when it
 * opens, which is always after mount, so the side is already correct the first
 * time anything is painted.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(query.matches)

    update()
    query.addEventListener('change', update)

    return () => query.removeEventListener('change', update)
  }, [])

  return isMobile
}
