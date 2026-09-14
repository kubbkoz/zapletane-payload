import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that bootstraps the production
 * database right after `20260914_194522_initial` has created the tables:
 *
 *   1. an admin user from ADMIN_EMAIL / ADMIN_PASSWORD, and
 *   2. the `payload-mcp-api-keys` grant for PAYLOAD_MCP_API_KEY, owned by that
 *      admin — the production equivalent of `npm run mcp:mint-key`
 *      (scripts/mint-mcp-key.ts), whose grant shape this mirrors 1:1.
 *
 * A fresh Neon database has no users at all, so without this the first deploy
 * would come up with an unreachable admin panel and a dead /api/mcp endpoint.
 *
 * Every step is idempotent (look up first, then create-or-update) and every
 * step is individually skipped — with a single log line — when its environment
 * variables are absent, so `npm run migrate` stays safe to re-run and safe to
 * run in an environment that only has the database credentials.
 *
 * All operations receive `req`, so they join the migration's transaction and
 * roll back together if anything fails.
 */

// Per-operation grants. These must mirror the `enabled` ceilings that
// src/plugins/index.ts gives `mcpPlugin()` — the API Keys collection only
// renders a checkbox for an operation the ceiling turns on, and every checkbox
// defaults to false, so an unlisted operation is denied. Kept identical to
// scripts/mint-mcp-key.ts so the production key has exactly the dev key's scope.
const fullCrud = { create: true, delete: true, find: true, update: true }
const findAndUpdate = { find: true, update: true }
const findOnly = { find: true }
const globalFullAccess = { find: true, update: true }

const KEY_LABEL = 'Production MCP key'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    payload.logger.info(
      '[seed_admin] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin user and MCP key seeding.',
    )
    return
  }

  // 1. Admin user. ADMIN_EMAIL is the idempotency key: an existing account is
  //    reused as-is (its password is never overwritten on a re-run).
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
    req,
  })

  let ownerId: number | string

  if (existing.docs.length > 0) {
    ownerId = existing.docs[0].id
    payload.logger.info(`[seed_admin] Admin user "${adminEmail}" already exists (id=${ownerId}).`)
  } else {
    const created = await payload.create({
      collection: 'users',
      data: {
        name: 'Admin',
        email: adminEmail,
        password: adminPassword,
        roles: ['admin'],
      },
      req,
    })
    ownerId = created.id
    payload.logger.info(`[seed_admin] Created admin user "${adminEmail}" (id=${ownerId}).`)
  }

  // 2. MCP API key grant, owned by that admin. Collection access (isAdmin)
  //    still gates the underlying CRUD, so the key has to belong to an admin
  //    for the full-CRUD collections to work end-to-end.
  const rawKey = process.env.PAYLOAD_MCP_API_KEY

  if (!rawKey) {
    payload.logger.info('[seed_admin] PAYLOAD_MCP_API_KEY not set — skipping MCP API key seeding.')
    return
  }

  const grantData = {
    user: ownerId,
    label: KEY_LABEL,
    description:
      'Production key for the /api/mcp server, seeded by src/migrations-pg/<timestamp>_seed_admin.ts from PAYLOAD_MCP_API_KEY. Scope mirrors scripts/mint-mcp-key.ts — see MCP-PLAN.md.',
    enableAPIKey: true,
    apiKey: rawKey,
    products: fullCrud,
    categories: fullCrud,
    pages: fullCrud,
    media: fullCrud,
    variants: fullCrud,
    variantOptions: fullCrud,
    variantTypes: fullCrud,
    orders: findAndUpdate,
    transactions: findAndUpdate,
    carts: findAndUpdate,
    addresses: findAndUpdate,
    users: findOnly,
    header: globalFullAccess,
    footer: globalFullAccess,
  }

  const existingKey = await payload.find({
    collection: 'payload-mcp-api-keys',
    where: {
      and: [{ label: { equals: KEY_LABEL } }, { user: { equals: ownerId } }],
    },
    limit: 1,
    req,
  })

  if (existingKey.docs.length > 0) {
    const keyDocId = existingKey.docs[0].id
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: keyDocId,
      data: grantData,
      req,
    })
    payload.logger.info(`[seed_admin] Updated existing MCP API key doc (id=${keyDocId}).`)
  } else {
    const createdKey = await payload.create({
      collection: 'payload-mcp-api-keys',
      data: grantData,
      req,
    })
    payload.logger.info(`[seed_admin] Created MCP API key doc (id=${createdKey.id}).`)
  }
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Intentionally a no-op. Rolling this migration back would delete the only
  // admin account and the MCP key, locking every operator out of the deployed
  // admin panel and API. Re-running `up` is the supported way to reconcile
  // these records; remove them by hand in the admin panel if that is really
  // what you want.
  payload.logger.info('[seed_admin] down() is a no-op — seeded admin user and MCP key are kept.')
}
