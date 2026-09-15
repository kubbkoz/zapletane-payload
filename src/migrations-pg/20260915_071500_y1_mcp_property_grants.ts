import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that finishes Y1 on a database that
 * already has rows.
 *
 * `20260915_070141_y1_product_data` created the four
 * `payload_mcp_api_keys.product_properties_*` checkbox columns, but — like
 * every capability checkbox the plugin generates — they default to FALSE. So
 * the production key would see that the `product-properties` tools *exist* and
 * be refused by all of them. This flips them on, mirroring what
 * `scripts/mint-mcp-key.ts` does for the local dev key and what
 * `20260914_223000_mcp_shipping_payment_grants` /
 * `20260915_060000_x1_grants_and_search_defaults` did for the earlier waves.
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
      `[y1_mcp_property_grants] No "${KEY_LABEL}" document found — nothing to widen.`,
    )
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        productProperties: fullCrud,
      },
      req,
    })

    payload.logger.info(
      `[y1_mcp_property_grants] Granted product-properties CRUD to MCP key doc (id=${doc.id}).`,
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
        productProperties: noAccess,
      },
      req,
    })
  }

  payload.logger.info('[y1_mcp_property_grants] Revoked product-properties grants.')
}
