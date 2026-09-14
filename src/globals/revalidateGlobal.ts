import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

/**
 * Cache tag for a global, matching `getCachedGlobal`'s `global_<slug>`
 * convention (src/utilities/getGlobals.ts) so a hand-rolled cached read and the
 * generic helper can never drift apart.
 */
export const globalCacheTag = (slug: string) => `global_${slug}`

/**
 * afterChange hook that flushes a global's cached copy the moment someone saves
 * it — from the admin UI, the REST API or an MCP client.
 *
 * Every cached read also carries its own `revalidate` ceiling, which is the
 * safety net for the cases where this hook cannot run (a direct DB write, or a
 * save outside a Next.js request scope such as a seed script or a migration —
 * `revalidateTag` throws there).
 */
export const revalidateGlobalHook =
  (slug: string, label = slug): GlobalAfterChangeHook =>
  ({ doc, req: { context, payload } }) => {
    if (!context.disableRevalidate) {
      try {
        // 'max' = purge now, regardless of the tag's cache-life profile.
        revalidateTag(globalCacheTag(slug), 'max')
        payload.logger.info(`Revalidated ${label}`)
      } catch (err) {
        payload.logger.warn({ err }, `Could not revalidate the "${slug}" global cache tag`)
      }
    }

    return doc
  }
