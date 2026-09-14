import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug.
 *
 * Two freshness mechanisms, the same pair `getSiteSettings` / `getHomepage`
 * document:
 *
 *   - tag `global_<slug>` — the floor. Every global registered in
 *     `src/globals/index.ts` carries an afterChange hook built by
 *     `revalidateGlobalHook`, so a save from the admin UI, the REST API or an
 *     MCP client is live on the next request.
 *   - `revalidate: 60` — the ceiling, for the changes that hook cannot see: a
 *     direct database write, a CLI script, a restore. Without it a cached
 *     global entry never expires on its own, so such a change would stay
 *     invisible until the next deploy.
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) =>
  unstable_cache(async () => getGlobal<T>(slug, depth), [slug, String(depth)], {
    revalidate: 60,
    tags: [`global_${slug}`],
  })
