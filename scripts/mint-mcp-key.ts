/**
 * Mint (or rotate) a local-dev Payload MCP API key.
 *
 * The MCP plugin's tool ceiling lives in `src/plugins/index.ts`
 * (`mcpPlugin({ collections: ..., globals: ... })`) — that config only
 * decides which tools *could* exist. The actual per-key grant is a separate
 * `payload-mcp-api-keys` document (see docs/plugins/mcp.mdx "Auth"), whose
 * per-operation checkboxes all default to *false*. This script creates (or
 * updates) exactly one such document for a local admin user, with every
 * checkbox that the ceiling exposes turned on, so the minted key exercises
 * the full approved scope end-to-end.
 *
 * Usage:
 *   npm run mcp:mint-key
 *   (equivalent to: cross-env NODE_OPTIONS=--no-deprecation tsx scripts/mint-mcp-key.ts)
 *
 * Idempotent: re-running updates the existing "Claude Code dev key" record
 * (rotating its secret) instead of creating a duplicate.
 *
 * The raw key is written straight into `.env` as PAYLOAD_MCP_API_KEY and is
 * never printed to stdout in full.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(dirname, '..')

// Load .env / .env.local the same way Next.js does, before importing the
// Payload config (which reads process.env.PAYLOAD_SECRET, DATABASE_URI, ...).
loadEnvConfig(projectRoot)

const KEY_LABEL = 'Claude Code dev key'
const DEV_ADMIN_EMAIL = process.env.MCP_DEV_ADMIN_EMAIL || 'mcp-dev@zapletane.local'

// Must mirror the `enabled` ceilings in src/plugins/index.ts exactly — only
// list the operations that ceiling actually turns on, since the API Keys
// collection only generates a checkbox field for enabled operations.
const fullCrud = { create: true, delete: true, find: true, update: true }
const findAndUpdate = { find: true, update: true }
const findOnly = { find: true }
const globalFullAccess = { find: true, update: true }

async function main() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config.js')

  const payload = await getPayload({ config })

  // 1. Find (or create) an admin user to own the dev key. Collection access
  //    (isAdmin) gates real CRUD on the underlying data regardless of which
  //    MCP tools are registered, so the key must belong to an admin for the
  //    "full CRUD" collections to actually work end-to-end.
  const existingAdmins = await payload.find({
    collection: 'users',
    where: { roles: { contains: 'admin' } },
    limit: 1,
  })

  let ownerId: number | string
  let ownerEmail: string
  if (existingAdmins.docs.length > 0) {
    ownerId = existingAdmins.docs[0].id
    ownerEmail = existingAdmins.docs[0].email
    payload.logger.info(`[mint-mcp-key] Using existing admin user "${ownerEmail}" (id=${ownerId})`)
  } else {
    const created = await payload.create({
      collection: 'users',
      data: {
        name: 'MCP Dev Admin',
        email: DEV_ADMIN_EMAIL,
        password: crypto.randomBytes(24).toString('hex'),
        roles: ['admin'],
      },
    })
    ownerId = created.id
    ownerEmail = created.email
    payload.logger.info(`[mint-mcp-key] Created admin user "${ownerEmail}" (id=${ownerId}) to own the MCP dev key`)
  }

  // 2. Build the grant payload — one group per collection/global, matching
  //    the approved scope 1:1.
  const rawKey = `mcp_dev_${crypto.randomBytes(32).toString('hex')}`

  const grantData = {
    user: ownerId,
    label: KEY_LABEL,
    description:
      'Local dev key for Claude Code (.mcp.json), minted by scripts/mint-mcp-key.ts. Rotate/replace for production — see MCP-PLAN.md.',
    enableAPIKey: true,
    apiKey: rawKey,
    products: fullCrud,
    categories: fullCrud,
    pages: fullCrud,
    media: fullCrud,
    variants: fullCrud,
    variantOptions: fullCrud,
    variantTypes: fullCrud,
    // W1 — doprava a platby. Shop configuration, same ceiling as the catalog.
    // Field names are the camel-cased collection slugs (`shipping-methods` ->
    // `shippingMethods`), which is how the MCP plugin generates them.
    shippingMethods: fullCrud,
    paymentMethods: fullCrud,
    // X1 — zľavové kódy a filtre v obchode. Shop configuration, same ceiling.
    discountCodes: fullCrud,
    productFilters: fullCrud,
    orders: findAndUpdate,
    transactions: findAndUpdate,
    carts: findAndUpdate,
    addresses: findAndUpdate,
    users: findOnly,
    header: globalFullAccess,
    footer: globalFullAccess,
    // W2 — editable homepage content (hero, slogan, value cards, tabs, gift CTA).
    homepage: globalFullAccess,
    siteSettings: globalFullAccess,
  }

  // 3. Create, or rotate the existing dev key in place (idempotent re-runs).
  const existingKey = await payload.find({
    collection: 'payload-mcp-api-keys',
    where: {
      and: [{ label: { equals: KEY_LABEL } }, { user: { equals: ownerId } }],
    },
    limit: 1,
  })

  let keyDocId: number | string
  if (existingKey.docs.length > 0) {
    keyDocId = existingKey.docs[0].id
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: keyDocId,
      data: grantData,
    })
    payload.logger.info(`[mint-mcp-key] Rotated existing MCP API key doc (id=${keyDocId})`)
  } else {
    const created = await payload.create({
      collection: 'payload-mcp-api-keys',
      data: grantData,
    })
    keyDocId = created.id
    payload.logger.info(`[mint-mcp-key] Created MCP API key doc (id=${keyDocId})`)
  }

  // 4. Persist into .env (raw value touches disk only, never stdout).
  const envPath = path.join(projectRoot, '.env')
  let envContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  const line = `PAYLOAD_MCP_API_KEY=${rawKey}`
  if (/^PAYLOAD_MCP_API_KEY=.*$/m.test(envContents)) {
    envContents = envContents.replace(/^PAYLOAD_MCP_API_KEY=.*$/m, line)
  } else {
    envContents =
      envContents.replace(/\n*$/, '\n') +
      `\n# Minted by scripts/mint-mcp-key.ts for the "${KEY_LABEL}" record — see MCP-PLAN.md §8.\n${line}\n`
  }
  fs.writeFileSync(envPath, envContents)

  const masked = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`
  payload.logger.info(
    `[mint-mcp-key] Wrote PAYLOAD_MCP_API_KEY=${masked} to .env (owner: ${ownerEmail}, key doc id=${keyDocId})`,
  )

  // Close the db connection cleanly (flushes/checkpoints the sqlite WAL)
  // before exiting — an abrupt `process.exit()` here left the sqlite file's
  // WAL uncheckpointed, which made the *next* cold `getPayload()` push
  // ("sync schema in dev") see stale index state and fail with
  // "index ... already exists".
  await payload.destroy()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('[mint-mcp-key] failed:', err)
  process.exit(1)
})
