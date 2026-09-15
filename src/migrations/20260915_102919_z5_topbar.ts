import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`header\` ADD \`top_bar_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`top_bar_mode\` text DEFAULT 'contact';`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`top_bar_marquee_text\` text DEFAULT 'Remeselná práca s láskou — doprava po celom Slovensku';`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`top_bar_marquee_speed\` text DEFAULT 'normal';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`top_bar_enabled\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`top_bar_mode\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`top_bar_marquee_text\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`top_bar_marquee_speed\`;`)
}
