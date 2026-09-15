import { parseTrackingScripts } from '@/lib/trackingScripts'
import { getSiteSettings } from '@/utilities/getSiteSettings'

import { TrackingNodes } from './renderNodes'

/**
 * Marketing tags that belong immediately after the opening `<body>` — in
 * practice the Google Tag Manager `<noscript>` iframe — read from
 * `site-settings.marketing.bodyStartScripts`.
 *
 * MOUNT IT AS THE FIRST CHILD OF `<body>` in `src/app/(app)/layout.tsx`:
 *
 *     <body>
 *       <TrackingScriptsBodyStart />
 *       <Providers>…
 *
 * It renders nothing at all when the field is empty, so it adds no wrapper
 * element and cannot affect layout.
 */
export async function TrackingScriptsBodyStart() {
  const siteSettings = await getSiteSettings()

  return <TrackingNodes nodes={parseTrackingScripts(siteSettings?.marketing?.bodyStartScripts)} />
}

export default TrackingScriptsBodyStart
