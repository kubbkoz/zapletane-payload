import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migrácia (žiadna zmena schémy), ktorá dokončuje Z12 na databáze,
 * v ktorej už riadky sú.
 *
 * `20260915_150558_z12_scraper` založila štyri stĺpce
 * `payload_mcp_api_keys.scraper_jobs_*`, ale — ako každý checkbox, ktorý plugin
 * generuje — s predvolenou hodnotou FALSE. Produkčný kľúč by teda videl, že
 * nástroje pre `scraper-jobs` *existujú*, a každý z nich by ho odmietol. Tu sa
 * zapnú, presne tak, ako to pre lokálny vývojový kľúč robí
 * `scripts/mint-mcp-key.ts` a ako to pre skoršie vlny spravili
 * `20260914_223000_mcp_shipping_payment_grants`,
 * `20260915_060000_x1_grants_and_search_defaults`,
 * `20260915_071500_y1_mcp_property_grants`, `20260915_072600_y2_feed_grants`
 * a `20260915_113500_z7_mcp_blog_redirect_grants`.
 *
 * Prečo plné CRUD vrátane `delete`: úloha importu je jednorazová vec — po
 * dobehnutí je z nej len historický záznam s frontou stoviek adries a
 * niekoľkokilobajtovým logom. Upratať ju musí byť možné bez nasadenia.
 *
 * Právomoc sa týka IBA dokumentu úlohy. Samotné sťahovanie z cudzieho webu
 * spúšťa `/api/scraper/run`, ktorá pýta prihlásenú administrátorku
 * (`payload.auth` + `checkRole(['admin'])`) a MCP kľúč neakceptuje — založenie
 * úlohy cez MCP teda nič nestiahne ani nenaimportuje.
 *
 * Hodnoty sú vpísané natvrdo, nie importované zo `src/plugins/index.ts`:
 * migrácia je snímka zámeru v danom okamihu a nesmie sa začať správať inak,
 * keď sa strop aplikácie neskôr zmení.
 *
 * Idempotentná a nedeštruktívna; opakované `npm run migrate` je bezpečné.
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
      `[z12_mcp_scraper_grants] No "${KEY_LABEL}" document found — nothing to widen.`,
    )
  }

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: {
        scraperJobs: fullCrud,
      },
      req,
    })

    payload.logger.info(
      `[z12_mcp_scraper_grants] Granted scraper-jobs CRUD to MCP key doc (id=${doc.id}).`,
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
        scraperJobs: noAccess,
      },
      req,
    })
  }

  payload.logger.info('[z12_mcp_scraper_grants] Revoked scraper-jobs grants.')
}
