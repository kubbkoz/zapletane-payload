/**
 * Temporary Y1 verification harness (deleted after the run).
 *
 * 1. Local API: product JSON (properties populated, dimensions, crossSell/upsell).
 * 2. Local API with overrideAccess:false as an admin user -> can the admin read
 *    the MCP API key document owned by *another* admin?
 * 3. REST + admin route: log a throwaway admin in and GET
 *    /admin/collections/payload-mcp-api-keys, expecting HTTP 200.
 */
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvConfig(path.resolve(dirname, '..'))

const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const CHECK_ADMIN_EMAIL = 'y1-check@zapletane.local'

async function main() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config.js')

  const payload = await getPayload({ config })

  // --- 1. product JSON -----------------------------------------------------
  const products = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 10,
    sort: 'slug',
  })

  for (const product of products.docs) {
    console.log(
      '\n[product]',
      JSON.stringify(
        {
          slug: product.slug,
          title: product.title,
          properties: product.properties?.map((entry) => ({
            property:
              typeof entry.property === 'object' && entry.property
                ? {
                    id: entry.property.id,
                    name: entry.property.name,
                    slug: entry.property.slug,
                    unit: entry.property.unit ?? null,
                    predefinedValues: entry.property.predefinedValues?.map((v) => v.value) ?? null,
                  }
                : entry.property,
            value: entry.value,
          })),
          dimensions: product.dimensions,
          crossSell: product.crossSell?.map((p) => (typeof p === 'object' ? p.id : p)),
          upsell: product.upsell?.map((p) => (typeof p === 'object' ? p.id : p)),
          relatedProducts: product.relatedProducts?.map((p) => (typeof p === 'object' ? p.id : p)),
        },
        null,
        2,
      ),
    )
  }

  const properties = await payload.find({ collection: 'product-properties', sort: 'sortOrder' })
  console.log(
    '\n[product-properties]',
    JSON.stringify(
      properties.docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        unit: doc.unit ?? null,
        predefinedValues: doc.predefinedValues?.map((v) => v.value) ?? [],
        sortOrder: doc.sortOrder,
      })),
      null,
      2,
    ),
  )

  // Public read on product-properties (no user, access enforced).
  const publicRead = await payload.find({
    collection: 'product-properties',
    overrideAccess: false,
    limit: 1,
  })
  console.log('\n[public read product-properties] totalDocs =', publicRead.totalDocs)

  // --- 2. MCP key visibility, access enforced ------------------------------
  const adminUsers = await payload.find({
    collection: 'users',
    where: { roles: { contains: 'admin' } },
    limit: 10,
  })

  // A throwaway *second* admin: the key doc belongs to the mint-script admin,
  // so this proves the override lifted the "own keys only" row filter.
  const secret = crypto.randomBytes(24).toString('hex')
  const existingCheckAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: CHECK_ADMIN_EMAIL } },
    limit: 1,
  })

  const checkAdmin =
    existingCheckAdmin.docs[0] ??
    (await payload.create({
      collection: 'users',
      data: {
        name: 'Y1 check admin',
        email: CHECK_ADMIN_EMAIL,
        password: secret,
        roles: ['admin'],
      },
    }))

  if (existingCheckAdmin.docs[0]) {
    await payload.update({
      collection: 'users',
      id: checkAdmin.id,
      data: { password: secret },
    })
  }

  const asAdmin = await payload.find({
    collection: 'payload-mcp-api-keys',
    depth: 0,
    overrideAccess: false,
    user: { ...checkAdmin, collection: 'users' } as never,
  })

  console.log(
    '\n[mcp keys as OTHER admin, overrideAccess:false]',
    JSON.stringify(
      {
        totalDocs: asAdmin.totalDocs,
        docs: asAdmin.docs.map((doc) => ({
          id: doc.id,
          label: doc.label,
          owner: doc.user,
          productProperties: doc.productProperties,
        })),
      },
      null,
      2,
    ),
  )

  const customer = await payload.create({
    collection: 'users',
    data: {
      name: 'Y1 check customer',
      email: 'y1-check-customer@zapletane.local',
      password: crypto.randomBytes(24).toString('hex'),
      roles: ['customer'],
    },
  })

  const asCustomer = await payload.find({
    collection: 'payload-mcp-api-keys',
    depth: 0,
    overrideAccess: false,
    user: { ...customer, collection: 'users' } as never,
  })
  console.log('\n[mcp keys as customer] totalDocs =', asCustomer.totalDocs)

  try {
    await payload.create({
      collection: 'product-properties',
      data: { name: 'Zakázaná vlastnosť', slug: 'zakazana-vlastnost' },
      overrideAccess: false,
      user: { ...customer, collection: 'users' } as never,
    })
    console.log('[product-properties create as customer] ALLOWED (unexpected)')
  } catch (err) {
    console.log(
      '[product-properties create as customer] refused:',
      (err as Error).constructor.name,
    )
  }

  await payload.delete({ collection: 'users', id: customer.id })

  console.log(
    '\n[admin users]',
    adminUsers.docs.map((u) => `${u.id}:${u.email}`).join(', '),
  )

  // --- 3. REST login + admin route ----------------------------------------
  const loginRes = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CHECK_ADMIN_EMAIL, password: secret }),
  })
  const loginJson = (await loginRes.json()) as { token?: string; user?: { email?: string } }
  console.log(
    '\n[REST login]',
    loginRes.status,
    loginJson.user?.email ?? '(no user)',
    loginJson.token ? 'token received' : 'NO TOKEN',
  )

  const cookie = `payload-token=${loginJson.token}`

  const adminRoute = await fetch(`${BASE}/admin/collections/payload-mcp-api-keys`, {
    headers: { cookie },
    redirect: 'manual',
  })
  const adminHtml = await adminRoute.text()
  console.log('[admin route] GET /admin/collections/payload-mcp-api-keys ->', adminRoute.status)
  console.log('[admin route] mentions "MCP API kľúče":', adminHtml.includes('MCP API kľúče'))
  console.log(
    '[admin route] lists the key label "Claude Code dev key":',
    adminHtml.includes('Claude Code dev key'),
  )
  console.log(
    '[admin route] nav contains product-properties link:',
    adminHtml.includes('/admin/collections/product-properties'),
  )

  const restKeys = await fetch(`${BASE}/api/payload-mcp-api-keys?depth=0`, { headers: { cookie } })
  const restKeysJson = (await restKeys.json()) as {
    totalDocs?: number
    docs?: Array<{ id: unknown; label?: string; user?: unknown }>
  }
  console.log(
    '\n[REST /api/payload-mcp-api-keys]',
    restKeys.status,
    JSON.stringify({
      totalDocs: restKeysJson.totalDocs,
      docs: restKeysJson.docs?.map((d) => ({ id: d.id, label: d.label, owner: d.user })),
    }),
  )

  const restProduct = await fetch(
    `${BASE}/api/products?where[slug][equals]=pletena-deka&depth=1&limit=1`,
  )
  const restProductJson = (await restProduct.json()) as {
    docs?: Array<Record<string, unknown>>
  }
  const doc = restProductJson.docs?.[0] ?? {}
  console.log(
    '\n[REST /api/products pletena-deka]',
    restProduct.status,
    JSON.stringify(
      {
        slug: doc.slug,
        properties: doc.properties,
        dimensions: doc.dimensions,
        crossSell: doc.crossSell,
        upsell: doc.upsell,
      },
      null,
      2,
    ),
  )

  // Clean up the throwaway admin so the dev database is left as seeded.
  await payload.delete({ collection: 'users', id: checkAdmin.id })

  await payload.destroy()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('[verify-y1] failed:', err)
  process.exit(1)
})
