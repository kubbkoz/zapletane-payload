import type { Homepage } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { HOMEPAGE_TAG } from '@/globals/Homepage'

/**
 * Homepage content, read once per 60s instead of once per request.
 *
 * Same two-mechanism freshness as `getSiteSettings`:
 *
 *   - `revalidate: 60` — the ceiling, covering changes Payload could not notify
 *     us about (a direct DB write, a CLI script).
 *   - tag `global_homepage` — the floor. The global's own afterChange hook
 *     revalidates it, so an edit from the admin UI or an MCP client is live on
 *     the next request.
 *
 * `depth: 1` resolves the hero/gift-CTA media uploads and the hotspot product
 * links; `findGlobal` returns the field defaults when the global has never been
 * saved, which is what makes a fresh deploy render the original hard-coded
 * content.
 */
const readHomepage = unstable_cache(
  async (): Promise<Homepage> => {
    const payload = await getPayload({ config: configPromise })

    return payload.findGlobal({ slug: 'homepage', depth: 1 })
  },
  ['homepage'],
  { revalidate: 60, tags: [HOMEPAGE_TAG] },
)

export async function getHomepage(): Promise<Homepage | null> {
  try {
    return await readHomepage()
  } catch (err) {
    // A storefront that cannot reach its database must still render: every
    // consumer falls back to the baked defaults in src/lib/homeDefaults.ts.
    console.error('[homepage] read failed, falling back to built-in content:', err)
    return null
  }
}
