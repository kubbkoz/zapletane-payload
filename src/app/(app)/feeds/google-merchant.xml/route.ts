import { serveFeed } from '@/lib/feeds/serve'

/**
 * GET /feeds/google-merchant.xml — Google Merchant Center product feed
 * (RSS 2.0 + the `g:` namespace).
 *
 * Dynamic on purpose: the body is cached by `getFeedPayload` (1h ceiling,
 * purged on every product or settings change), so route-level static rendering
 * would only add a second, staler cache that a build — not an edit — controls.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return serveFeed('google-xml')
}
