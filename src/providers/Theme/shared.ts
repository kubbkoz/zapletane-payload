import type { Theme } from './types'

export const themeLocalStorageKey = 'payload-theme'

export const defaultTheme = 'light'

/**
 * Z17 pin: the STOREFRONT ((app) tree) is a light-only, warm-cream design —
 * design.md has no dark palette, and RichText's `dark:prose-invert` was the
 * one thing in this app that actually branched on it, flipping article/PDP
 * text to white-on-cream for anyone with a dark system preference (the
 * `[data-theme='dark']` this function used to derive from `matchMedia`).
 * Deliberately no longer reading `prefers-color-scheme` here — this is the
 * one shared function both `InitTheme`'s pre-hydration script (its own
 * literal copy, kept in sync by hand) and `ThemeProvider`'s mount effect
 * fall back to, so both now agree on 'light' regardless of the device.
 * `ThemeProvider`/`ThemeSelector` (unused by the storefront UI today) are
 * left in place — restoring a real dark variant later means reinstating the
 * `matchMedia` read here, not rebuilding the mechanism.
 */
export const getImplicitPreference = (): Theme | null => defaultTheme
