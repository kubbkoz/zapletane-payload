import { parseTrackingScripts } from '@/lib/trackingScripts'
import { getSiteSettings } from '@/utilities/getSiteSettings'

import { TrackingNodes } from './renderNodes'

/**
 * Marketing tags for `<head>` (Meta Pixel, GTM container, GA4, site
 * verification), read from `site-settings.marketing.headScripts`.
 *
 * MOUNT IT INSIDE THE `<head>` ELEMENT of `src/app/(app)/layout.tsx`:
 *
 *     <head>
 *       <TrackingScriptsHead />
 *       …
 *     </head>
 *
 * Why there and not `next/script`: `strategy="beforeInteractive"` is only
 * honoured in the root layout and still defers execution behind Next's own
 * bootstrap, while a tag manager wants to be the first thing the page runs.
 * Rendering the parsed elements straight into `<head>` reproduces the exact
 * snippet Google and Meta document, with no client-side runtime involved.
 *
 * Server component: it never ships to the browser, and the snippet is fetched
 * with the cached `getSiteSettings()` read (tag `global_site-settings`, so an
 * admin save is live on the next request).
 */
export async function TrackingScriptsHead() {
  const siteSettings = await getSiteSettings()

  return <TrackingNodes nodes={parseTrackingScripts(siteSettings?.marketing?.headScripts)} />
}

export default TrackingScriptsHead
