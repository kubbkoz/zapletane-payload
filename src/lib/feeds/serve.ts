import { getFeedPayload } from './build'
import { renderGoogleXml, renderMetaCsv } from './render'

export type FeedFormat = 'google-xml' | 'meta-csv' | 'meta-xml'

/**
 * Excel refuses to guess UTF-8 for a .csv and mangles every Slovak diacritic
 * unless the file starts with a byte-order mark. Meta's importer skips it.
 */
const UTF8_BOM = '﻿'

/**
 * Shared body of the three feed route handlers.
 *
 * Route handlers are *not* wrapped by `src/app/(app)/layout.tsx`, so the
 * pre-launch ("coming soon") gate that lives in that layout does not apply to
 * them — a gated, not-yet-launched shop can still hand a feed to Google. The
 * feed's own switch is `feed-settings.enabled`, and while it is off every feed
 * URL is a 404 (not a 403: an unannounced feed URL should not confirm that
 * anything exists behind it).
 */
export async function serveFeed(format: FeedFormat): Promise<Response> {
  let payload

  try {
    payload = await getFeedPayload()
  } catch (error) {
    console.error('[feeds] build failed:', error)

    return new Response('Feed temporarily unavailable', {
      status: 503,
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (!payload.enabled) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const isCsv = format === 'meta-csv'
  const body = isCsv ? `${UTF8_BOM}${renderMetaCsv(payload)}` : renderGoogleXml(payload)

  const headers: Record<string, string> = {
    // The body is already cached server-side for an hour and purged on every
    // product change; the same contract is offered to any CDN in front of it.
    'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    'content-type': isCsv ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8',
    // The CSV has no place for the comments the XML carries, so the counts
    // travel as headers on every feed.
    'x-feed-generated-at': payload.generatedAt,
    'x-feed-items': String(payload.items.length),
    'x-feed-skipped-no-image': String(payload.skippedNoImage),
    'x-feed-skipped-no-price': String(payload.skippedNoPrice),
  }

  if (isCsv) {
    headers['content-disposition'] = 'attachment; filename="meta-catalog.csv"'
  }

  return new Response(body, { headers, status: 200 })
}
