import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Z14 — sqlite dvojička k `src/migrations-pg/20260915_190430_z14_scraper_categories_chain`.
 *
 * Tie isté štyri stĺpce. Stavový enum tu chýba zámerne: sqlite ukladá `select`
 * ako obyčajný `text` a kontrolu hodnôt robí Payload nad konfiguráciou, takže
 * nové stavy („categories_ready", „stopped") nepotrebujú žiadne DDL — kým
 * Postgres musí rozšíriť skutočný enumový typ.
 *
 * `posts.ai_prompt` / `_posts_v.version_ai_prompt` sú prívesok z rozpracovanej
 * práce iného agenta, ktorý bol v konfigurácii pri generovaní — vysvetlené v
 * hlavičke PG dvojičky.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`posts\` ADD \`ai_prompt\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_ai_prompt\` text;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` ADD \`counters_skipped_existing\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` ADD \`category_map\` text;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` ADD \`heartbeat_at\` text;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` ADD \`chain_count\` numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`ai_prompt\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_ai_prompt\`;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` DROP COLUMN \`counters_skipped_existing\`;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` DROP COLUMN \`category_map\`;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` DROP COLUMN \`heartbeat_at\`;`)
  await db.run(sql`ALTER TABLE \`scraper_jobs\` DROP COLUMN \`chain_count\`;`)
}
