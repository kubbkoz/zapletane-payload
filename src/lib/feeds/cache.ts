import type { Payload } from 'payload'

import { revalidateTag } from 'next/cache'

/**
 * Cache tag every rendered product feed is stored under.
 *
 * Deliberately a *single* tag shared by all three feeds (Google XML, Meta XML,
 * Meta CSV): they are three renderings of one dataset, so anything that
 * invalidates one invalidates all of them.
 *
 * Who purges it:
 *   - `products` afterChange / afterDelete (src/collections/Products/index.ts)
 *     — any catalog edit, from the admin UI, the REST API, MCP or checkout.
 *   - the `feed-settings` global's afterChange (src/globals/FeedSettings.ts)
 *     — defaults and attribute mappings are baked into the rendered body.
 *
 * The 1h `revalidate` on the cached builder is the ceiling for everything these
 * hooks cannot see (a direct DB write, a migration, a seed script).
 */
export const FEEDS_TAG = 'feeds'

/**
 * Purge the feeds, tolerating the contexts where that is impossible.
 *
 * `revalidateTag` throws outside a Next.js request scope — a `payload` CLI run,
 * a migration or `scripts/seed-dev.ts` all write products without one — and a
 * seed must not fail because a cache could not be flushed. The 1h ceiling
 * covers those writes anyway.
 */
export const revalidateFeedsTag = (payload?: Payload): void => {
  try {
    // 'max' = purge now, regardless of the tag's cache-life profile.
    revalidateTag(FEEDS_TAG, 'max')
    payload?.logger.info('Revalidated product feeds')
  } catch (err) {
    payload?.logger.warn({ err }, 'Could not revalidate the "feeds" cache tag')
  }
}
