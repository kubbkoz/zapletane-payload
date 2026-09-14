import type { SiteSetting } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { SITE_SETTINGS_TAG } from '@/globals/SiteSettings'

/**
 * Pre-launch gate state, read once per 30s instead of once per request.
 *
 * The root layout of the (app) group calls this on *every* storefront render,
 * so an uncached `findGlobal` would mean a DB round-trip per request. Two
 * mechanisms keep the cached value fresh:
 *
 *   - `revalidate: 30` — the ceiling. Even a change Payload could not notify us
 *     about (a direct DB write, a CLI script) is live inside half a minute.
 *   - tag `global_site-settings` — the floor. The global's own afterChange hook
 *     revalidates it, so a toggle from the admin UI or an MCP client is live on
 *     the next request.
 *
 * `findGlobal` returns the field defaults when the global has never been saved,
 * which is what makes a fresh deploy start gated (comingSoonEnabled: true).
 */
const readSiteSettings = unstable_cache(
  async (): Promise<SiteSetting> => {
    const payload = await getPayload({ config: configPromise })

    return payload.findGlobal({ slug: 'site-settings', depth: 0 })
  },
  ['site-settings'],
  { revalidate: 30, tags: [SITE_SETTINGS_TAG] },
)

export async function getSiteSettings(): Promise<SiteSetting | null> {
  try {
    return await readSiteSettings()
  } catch (err) {
    // A storefront that cannot reach its database must not 500 on every route.
    // Falling through to `null` lets the caller decide; the gate treats it as
    // "not gated" so an outage never locks the whole site behind the
    // pre-launch page.
    console.error('[site-settings] read failed, continuing ungated:', err)
    return null
  }
}
