import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`feed_settings_attribute_mappings\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`feed_attribute\` text NOT NULL,
  	\`source\` text NOT NULL,
  	\`custom_attribute\` text,
  	\`property_id\` integer,
  	\`static_value\` text,
  	FOREIGN KEY (\`property_id\`) REFERENCES \`product_properties\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`feed_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`feed_settings_attribute_mappings_order_idx\` ON \`feed_settings_attribute_mappings\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`feed_settings_attribute_mappings_parent_id_idx\` ON \`feed_settings_attribute_mappings\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`feed_settings_attribute_mappings_property_idx\` ON \`feed_settings_attribute_mappings\` (\`property_id\`);`)
  await db.run(sql`CREATE TABLE \`feed_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`enabled\` integer DEFAULT false,
  	\`defaults_brand\` text DEFAULT 'ZAPLETANE',
  	\`defaults_condition\` text DEFAULT 'new',
  	\`defaults_google_product_category\` text,
  	\`defaults_shipping_country\` text DEFAULT 'SK',
  	\`defaults_shipping_price_override\` numeric,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`feed_settings_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`feed_settings_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`marketing_head_scripts\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`marketing_body_start_scripts\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`feed_settings_attribute_mappings\`;`)
  await db.run(sql`DROP TABLE \`feed_settings\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`feed_settings_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`feed_settings_update\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`marketing_head_scripts\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`marketing_body_start_scripts\`;`)
}
