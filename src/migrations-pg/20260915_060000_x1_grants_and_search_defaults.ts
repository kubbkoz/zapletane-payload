import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that finishes X1 on a database that
 * already has rows.
 *
 * Two jobs, both of them backfills that `20260915_055107_x1_commerce_schema`
 * cannot do with an `ADD COLUMN ... DEFAULT`:
 *
 * 1. **MCP grants.** That migration created the `discount_codes_*` /
 *    `product_filters_*` checkbox columns on `payload_mcp_api_keys`, but every
 *    checkbox defaults to FALSE — so the production key can see the new tools'
 *    *existence* and nothing else. This flips them on, mirroring what
 *    `scripts/mint-mcp-key.ts` does for the local dev key, exactly like
 *    `20260914_223000_mcp_shipping_payment_grants` did for W1's collections.
 *
 * 2. **`site-settings.search.searchFields`.** The three scalar search columns
 *    carry their defaults as SQL DEFAULTs, so Postgres backfills the existing
 *    `site_settings` row for free. The multi-select is a separate table
 *    (`site_settings_search_search_fields`) and starts empty, which would show
 *    an editor "no fields are searched" where the field default says
 *    title + description. This writes that default in — and only when the list
 *    is still empty, so a deliberate narrowing is never stomped on.
 *
 * The values are inlined rather than imported from the collection config on
 * purpose: a migration is a snapshot of intent at a point in time and must not
 * start behaving differently when the app's defaults are later edited.
 *
 * Idempotent and non-destructive; re-running `npm run migrate` is safe. It
 * never reads or writes a secret — the API key value itself is left untouched.
 */

const fullCrud = { create: true, delete: true, find: true, update: true }

const KEY_LABEL = 'Production MCP key'

/** Must match SiteSettings.search.searchFields `defaultValue`. */
const DEFAULT_SEARCH_FIELDS = ['title', 'description'] as const

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  if (docs.length === 0) {
    payload.logger.info(
      `[x1_grants_and_search_defaults] No "${KEY_LABEL}" document found — nothing to widen. Run the seed_admin migration with PAYLOAD_MCP_API_KEY set first.`,
    )
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        discountCodes: fullCrud,
        productFilters: fullCrud,
      },
      req,
    })

    payload.logger.info(
      `[x1_grants_and_search_defaults] Granted discount-codes / product-filters to MCP key doc (id=${doc.id}).`,
    )
  }

  const siteSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0, req })

  if (siteSettings?.updatedAt && !siteSettings.search?.searchFields?.length) {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { search: { ...(siteSettings.search ?? {}), searchFields: [...DEFAULT_SEARCH_FIELDS] } },
      req,
    })

    payload.logger.info(
      '[x1_grants_and_search_defaults] Backfilled site-settings.search.searchFields with the default title + description.',
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
        discountCodes: noAccess,
        productFilters: noAccess,
      },
      req,
    })
  }

  payload.logger.info(
    '[x1_grants_and_search_defaults] Revoked discount-codes / product-filters grants (search defaults left intact — the schema migration drops those columns).',
  )
}
