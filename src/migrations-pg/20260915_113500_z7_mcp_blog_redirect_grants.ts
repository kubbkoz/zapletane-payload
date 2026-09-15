import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that finishes Z7 on a database that
 * already has rows.
 *
 * `20260915_113059_z7_blog_slugs_redirects` created the eight
 * `payload_mcp_api_keys.posts_*` / `redirects_*` checkbox columns, but — like
 * every capability checkbox the plugin generates — they default to FALSE. So
 * the production key would see that the `posts` and `redirects` tools *exist*
 * and be refused by all of them. This flips them on, mirroring what
 * `scripts/mint-mcp-key.ts` does for the local dev key and what
 * `20260914_223000_mcp_shipping_payment_grants`,
 * `20260915_060000_x1_grants_and_search_defaults`,
 * `20260915_071500_y1_mcp_property_grants` and `20260915_072600_y2_feed_grants`
 * did for the earlier waves.
 *
 * Why `redirects` gets delete as well: a botched rename can leave a redirect
 * pointing at the wrong place, and the fix must not require a deploy.
 *
 * Only the capability checkboxes are written: the key's secret, its owner and
 * its label are never read or modified, and no new key document is created.
 *
 * The values are inlined rather than imported from `src/plugins/index.ts` on
 * purpose — a migration is a snapshot of intent at a point in time and must not
 * start behaving differently when the app's ceiling is later edited.
 *
 * Idempotent and non-destructive; re-running `npm run migrate` is safe.
 */

const fullCrud = { create: true, delete: true, find: true, update: true }

const KEY_LABEL = 'Production MCP key'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  if (docs.length === 0) {
    payload.logger.info(
      `[z7_mcp_blog_redirect_grants] No "${KEY_LABEL}" document found — nothing to widen.`,
    )
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        posts: fullCrud,
        redirects: fullCrud,
      },
      req,
    })

    payload.logger.info(
      `[z7_mcp_blog_redirect_grants] Granted posts + redirects CRUD to MCP key doc (id=${doc.id}).`,
    )
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  const noAccess = { create: false, delete: false, find: false, update: false }

  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        posts: noAccess,
        redirects: noAccess,
      },
      req,
    })
  }

  payload.logger.info('[z7_mcp_blog_redirect_grants] Revoked posts + redirects grants.')
}
