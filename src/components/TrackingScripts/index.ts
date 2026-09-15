/**
 * Marketing / measurement tags stored in `site-settings.marketing` (Y2).
 *
 * Two mount points, both server components:
 *   - `<TrackingScriptsHead />`      — inside `<head>` of src/app/(app)/layout.tsx
 *   - `<TrackingScriptsBodyStart />` — first child of `<body>` in the same file
 *
 * See `src/lib/trackingScripts.ts` for what the parser recognises and what it
 * deliberately ignores.
 */
export { TrackingScriptsBodyStart } from './BodyStart'
export { TrackingScriptsHead } from './Head'
export { TrackingNodes } from './renderNodes'
