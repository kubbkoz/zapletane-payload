import { serveFeed } from '@/lib/feeds/serve'

/**
 * GET /feeds/meta-catalog.csv — Meta commerce catalog in Meta's own CSV
 * vocabulary (availability spelled „in stock", `shipping_weight` instead of
 * Google's dimensional attributes), UTF-8 with a BOM so Excel opens it with
 * the Slovak diacritics intact.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return serveFeed('meta-csv')
}
