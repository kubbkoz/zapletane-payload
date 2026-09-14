import type { ResolvedContact } from '@/lib/contact'

import { resolveContact } from '@/lib/contact'
import { getSiteSettings } from '@/utilities/getSiteSettings'

/**
 * Contact facts for a server render: the `site-settings` global merged over the
 * baked constants.
 *
 * No cache of its own — `getSiteSettings` is already an `unstable_cache` read
 * tagged `global_site-settings` (30s ceiling, revalidated by the global's
 * afterChange hook), and this is a pure merge on top of it. A failed read falls
 * all the way back to the constants, so the header and footer never go blank
 * because the database blinked.
 */
export async function getContact(): Promise<ResolvedContact> {
  return resolveContact(await getSiteSettings())
}
