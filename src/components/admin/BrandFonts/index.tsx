import React from 'react'

/**
 * Self-hosted ZAPLETANE webfonts for the Payload admin panel.
 *
 * The `(payload)` route group has its own root layout and never imports
 * `src/app/(app)/globals.css`, so the storefront's @fontsource imports do not
 * reach the admin. Importing the @fontsource CSS from SCSS is not an option —
 * Sass passes a `.css` import straight through as `@import url(...)`, and an
 * extensionless import would inline the rules without rebasing their relative
 * `url(./files/…)` references. Importing from a component instead lets the
 * bundler resolve and emit the woff2 files exactly as it does for the
 * storefront. No Google Fonts CDN anywhere.
 *
 * This component is registered as `admin.components.providers`, which
 * Payload's RootLayout renders around EVERY admin view (login included), so the
 * CSS is statically reachable from the admin layout's module graph.
 *
 * DM Sans: 400/500/700, latin + latin-ext (latin-ext carries the Slovak
 * diacritics — č ď ľ ň ŕ š ť ž).
 * Unbounded: variable weight axis, one file per subset; the browser only
 * downloads the subsets it needs thanks to the unicode-range descriptors.
 */
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-ext-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-ext-500.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/dm-sans/latin-ext-700.css'
import '@fontsource-variable/unbounded'

export const BrandFonts: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <React.Fragment>{children}</React.Fragment>
)

export default BrandFonts
