/**
 * Marketing / measurement tags stored in `site-settings.marketing` (Y2).
 *
 * Two mount points, both server components:
 *   - `<TrackingScriptsHead />`      — inside `<head>` of src/app/(app)/layout.tsx
 *   - `<TrackingScriptsBodyStart />` — first child of `<body>` in the same file
 *
 * See `src/lib/trackingScripts.ts` for what the parser recognises and what it
 * deliberately ignores.
 *
 * Both mount points render their `<script>` tags INERT
 * (`type="text/plain" data-category="analytics"`); `vanilla-cookieconsent`
 * activates them once the shopper accepts analytics. See `renderNodes.tsx` and
 * `src/components/CookieConsent/`.
 */
export { TrackingScriptsBodyStart } from './BodyStart'
export { TrackingScriptsHead } from './Head'
export { TrackingNodes } from './renderNodes'
