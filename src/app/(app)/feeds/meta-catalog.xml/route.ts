import { serveFeed } from '@/lib/feeds/serve'

/**
 * GET /feeds/meta-catalog.xml — Meta (Facebook/Instagram) commerce catalog.
 *
 * Byte-for-byte the same document as the Google feed: Meta's catalog importer
 * accepts Google's RSS 2.0 `g:` format, and keeping one renderer means the two
 * feeds can never disagree about the same product. The dedicated CSV feed next
 * to it exists for Meta's own column vocabulary.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return serveFeed('meta-xml')
}
