import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that finishes Y2 on a database that
 * already has rows.
 *
 * `20260915_072320_y2_feeds_tracking` created the two
 * `payload_mcp_api_keys.feed_settings_*` checkbox columns, but — like every
 * capability checkbox the MCP plugin generates — they default to FALSE. So the
 * production key would see that the `feed-settings` tools *exist* and be
 * refused by both of them, and the shop owner's agent could not switch the
 * feeds on or edit an attribute mapping.
 *
 * Mirrors `scripts/mint-mcp-key.ts` (`feedSettings: { find, update }`) and the
 * earlier waves' grant migrations (`20260914_231500_content_defaults`,
 * `20260915_071500_y1_mcp_property_grants`). Globals only ever support
 * find/update, so that is the whole ceiling.
 *
 * Only the capability checkboxes are written: the key's secret, owner and label
 * are never read or modified, and no key document is created. The values are
 * inlined rather than imported from `src/plugins/index.ts` on purpose — a
 * migration is a snapshot of intent, not a live reference.
 *
 * Idempotent and non-destructive; re-running `npm run migrate` is safe.
 */

const globalFullAccess = { find: true, update: true }

const KEY_LABEL = 'Production MCP key'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  if (docs.length === 0) {
    payload.logger.info(`[y2_feed_grants] No "${KEY_LABEL}" document found — nothing to widen.`)
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        feedSettings: globalFullAccess,
      },
      req,
    })

    payload.logger.info(
      `[y2_feed_grants] Granted feed-settings find/update to MCP key doc (id=${doc.id}).`,
    )
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  const noAccess = { find: false, update: false }

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
        feedSettings: noAccess,
      },
      req,
    })
  }

  payload.logger.info('[y2_feed_grants] Revoked feed-settings grants.')
}
