import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * SQLite counterpart of `src/migrations-pg/20260914_213000_eur_currency`.
 *
 * The Postgres chain got this migration when the shop switched from the
 * template's USD to EUR; the SQLite chain never did, because local dev runs the
 * adapter in push mode and therefore never replays migrations. That left the
 * SQLite snapshot describing `price_in_u_s_d*` columns, so the *next*
 * `payload migrate:create` diffed USD -> EUR as a rename and stopped on an
 * interactive prompt. Backfilling it here (same timestamp as its Postgres twin)
 * keeps the two chains in step and the generator non-interactive.
 *
 * Hand-written for the same reason the Postgres one was: drizzle's generator
 * emits add+drop for a rename when run non-interactively, which would throw the
 * prices away. `RENAME COLUMN` keeps them.
 *
 * Note: SQLite cannot change a column DEFAULT without rebuilding the table, so
 * the `currency` columns keep their `'USD'` default here while the snapshot
 * records `'EUR'`. Harmless — Payload always writes `currency` explicitly, and
 * this chain is dev-only.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`products\` RENAME COLUMN \`price_in_u_s_d\` TO \`price_in_e_u_r\`;`)
  await db.run(
    sql`ALTER TABLE \`products\` RENAME COLUMN \`price_in_u_s_d_enabled\` TO \`price_in_e_u_r_enabled\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_products_v\` RENAME COLUMN \`version_price_in_u_s_d\` TO \`version_price_in_e_u_r\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_products_v\` RENAME COLUMN \`version_price_in_u_s_d_enabled\` TO \`version_price_in_e_u_r_enabled\`;`,
  )
  await db.run(sql`ALTER TABLE \`variants\` RENAME COLUMN \`price_in_u_s_d\` TO \`price_in_e_u_r\`;`)
  await db.run(
    sql`ALTER TABLE \`variants\` RENAME COLUMN \`price_in_u_s_d_enabled\` TO \`price_in_e_u_r_enabled\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_variants_v\` RENAME COLUMN \`version_price_in_u_s_d\` TO \`version_price_in_e_u_r\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_variants_v\` RENAME COLUMN \`version_price_in_u_s_d_enabled\` TO \`version_price_in_e_u_r_enabled\`;`,
  )
  await db.run(sql`UPDATE \`carts\` SET \`currency\` = 'EUR' WHERE \`currency\` = 'USD';`)
  await db.run(sql`UPDATE \`orders\` SET \`currency\` = 'EUR' WHERE \`currency\` = 'USD';`)
  await db.run(sql`UPDATE \`transactions\` SET \`currency\` = 'EUR' WHERE \`currency\` = 'USD';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`products\` RENAME COLUMN \`price_in_e_u_r\` TO \`price_in_u_s_d\`;`)
  await db.run(
    sql`ALTER TABLE \`products\` RENAME COLUMN \`price_in_e_u_r_enabled\` TO \`price_in_u_s_d_enabled\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_products_v\` RENAME COLUMN \`version_price_in_e_u_r\` TO \`version_price_in_u_s_d\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_products_v\` RENAME COLUMN \`version_price_in_e_u_r_enabled\` TO \`version_price_in_u_s_d_enabled\`;`,
  )
  await db.run(sql`ALTER TABLE \`variants\` RENAME COLUMN \`price_in_e_u_r\` TO \`price_in_u_s_d\`;`)
  await db.run(
    sql`ALTER TABLE \`variants\` RENAME COLUMN \`price_in_e_u_r_enabled\` TO \`price_in_u_s_d_enabled\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_variants_v\` RENAME COLUMN \`version_price_in_e_u_r\` TO \`version_price_in_u_s_d\`;`,
  )
  await db.run(
    sql`ALTER TABLE \`_variants_v\` RENAME COLUMN \`version_price_in_e_u_r_enabled\` TO \`version_price_in_u_s_d_enabled\`;`,
  )
  await db.run(sql`UPDATE \`carts\` SET \`currency\` = 'USD' WHERE \`currency\` = 'EUR';`)
  await db.run(sql`UPDATE \`orders\` SET \`currency\` = 'USD' WHERE \`currency\` = 'EUR';`)
  await db.run(sql`UPDATE \`transactions\` SET \`currency\` = 'USD' WHERE \`currency\` = 'EUR';`)
}
