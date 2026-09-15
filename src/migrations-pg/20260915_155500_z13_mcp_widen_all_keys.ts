import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migrácia: zjednotenie MCP grantov na VŠETKÝCH existujúcich
 * API kľúčoch.
 *
 * Prečo: nástroje v /api/mcp sa filtrujú podľa checkboxov na KONKRÉTNOM
 * autentifikovanom kľúči. Doterajšie grant-migrácie (w1, x1, y1, y2, z7, z12)
 * rozširovali len dokument s labelom „Production MCP key" — kľúč, ktorý si
 * majiteľ založil sám (a ktorým reálne pracuje Claude session), tak ostal
 * so stavom checkboxov z doby svojho vzniku a všetky neskôr pridané
 * kolekcie (properties, feedy, posts, redirects, scraper…) mu v tools/list
 * chýbali.
 *
 * Riešenie: zapísať plný zamýšľaný grant-set (zrkadlo scripts/mint-mcp-key.ts
 * a stropov v src/plugins/index.ts k dnešnému dňu) na KAŽDÝ existujúci kľúč.
 * Nové kľúče založené v budúcnosti dostanú defaulty (false) ako doteraz —
 * toto nie je zmena politiky, len dorovnanie existujúcich dokumentov.
 *
 * Hodnoty sú vpísané natvrdo (snímka zámeru), nie importované z konfigurácie.
 * Idempotentná, nedeštruktívna.
 */

const fullCrud = { create: true, delete: true, find: true, update: true }
const findAndUpdate = { create: false, delete: false, find: true, update: true }
const findOnly = { create: false, delete: false, find: true, update: false }
const globalFullAccess = { find: true, update: true }

const GRANTS = {
  products: fullCrud,
  categories: fullCrud,
  pages: fullCrud,
  posts: fullCrud,
  redirects: fullCrud,
  media: fullCrud,
  variants: fullCrud,
  variantOptions: fullCrud,
  variantTypes: fullCrud,
  shippingMethods: fullCrud,
  paymentMethods: fullCrud,
  discountCodes: fullCrud,
  productFilters: fullCrud,
  productProperties: fullCrud,
  scraperJobs: fullCrud,
  orders: findAndUpdate,
  transactions: findAndUpdate,
  carts: findAndUpdate,
  addresses: findAndUpdate,
  users: findOnly,
  header: globalFullAccess,
  footer: globalFullAccess,
  homepage: globalFullAccess,
  siteSettings: globalFullAccess,
  feedSettings: globalFullAccess,
  statistiky: { find: true, update: false },
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 50,
    req,
  })

  if (docs.length === 0) {
    payload.logger.info('[z13_mcp_widen_all_keys] No MCP key documents found — nothing to widen.')
    return
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: GRANTS,
      req,
    })

    payload.logger.info(
      `[z13_mcp_widen_all_keys] Unified grants applied to MCP key doc (id=${doc.id}, label=${String(
        (doc as { label?: unknown }).label ?? '',
      )}).`,
    )
  }
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Vedomo prázdne: down by musel poznať stav checkboxov pred migráciou,
  // ktorý sa nikam neukladá. Granty sa dajú kedykoľvek upraviť v admine.
  payload.logger.info('[z13_mcp_widen_all_keys] down je no-op.')
}
