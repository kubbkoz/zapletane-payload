import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that widens the production MCP API
 * key to the collections W1 added.
 *
 * `20260914_222406_shipping_payments` created the `shipping_methods_*` /
 * `payment_methods_*` checkbox columns on `payload_mcp_api_keys`, but every
 * checkbox defaults to FALSE — so the key minted by `seed_admin` can see the
 * new tools' *existence* and nothing else. This flips them on, mirroring what
 * `scripts/mint-mcp-key.ts` does for the local dev key.
 *
 * It also grants the `site-settings` global, which `seed_admin` predates: the
 * MCP plugin derives its globals map from `globalConfigs`, so `site-settings`
 * has been exposed since it was added, with no key permitted to use it.
 *
 * Idempotent and non-destructive: it updates the existing key document in place
 * and touches nothing else, so re-running `npm run migrate` is safe. It never
 * reads or writes a secret — the API key value itself is left exactly as it is.
 */

const fullCrud = { create: true, delete: true, find: true, update: true }
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
    payload.logger.info(
      `[mcp_shipping_payment_grants] No "${KEY_LABEL}" document found — nothing to widen. Run the seed_admin migration with PAYLOAD_MCP_API_KEY set first.`,
    )
    return
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        paymentMethods: fullCrud,
        shippingMethods: fullCrud,
        siteSettings: globalFullAccess,
      },
      req,
    })

    payload.logger.info(
      `[mcp_shipping_payment_grants] Granted shipping-methods / payment-methods / site-settings to MCP key doc (id=${doc.id}).`,
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
        paymentMethods: noAccess,
        shippingMethods: noAccess,
      },
      req,
    })
  }

  payload.logger.info(
    '[mcp_shipping_payment_grants] Revoked shipping-methods / payment-methods grants (site-settings left intact).',
  )
}
