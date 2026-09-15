import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`statistiky\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_placeholder\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`statistiky_find\` integer DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`statistiky\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`statistiky_find\`;`)
}
