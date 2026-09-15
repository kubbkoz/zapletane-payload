import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`oauth_provider\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`oauth_sub\` text;`)
  await db.run(sql`CREATE INDEX \`users_oauth_sub_idx\` ON \`users\` (\`oauth_sub\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`users_oauth_sub_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`oauth_provider\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`oauth_sub\`;`)
}
