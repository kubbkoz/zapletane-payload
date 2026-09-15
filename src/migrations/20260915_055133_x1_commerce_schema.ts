import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`discount_codes\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`code\` text NOT NULL,
  	\`type\` text DEFAULT 'percent' NOT NULL,
  	\`value\` numeric NOT NULL,
  	\`min_subtotal\` numeric,
  	\`valid_from\` text,
  	\`valid_until\` text,
  	\`max_uses\` numeric,
  	\`used_count\` numeric DEFAULT 0,
  	\`enabled\` integer DEFAULT true,
  	\`note\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`discount_codes_code_idx\` ON \`discount_codes\` (\`code\`);`)
  await db.run(sql`CREATE INDEX \`discount_codes_updated_at_idx\` ON \`discount_codes\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`discount_codes_created_at_idx\` ON \`discount_codes\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`product_filters_options\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_filters\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_filters_options_order_idx\` ON \`product_filters_options\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_options_parent_id_idx\` ON \`product_filters_options\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_filters\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`type\` text DEFAULT 'tags' NOT NULL,
  	\`enabled\` integer DEFAULT true,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_filters_slug_idx\` ON \`product_filters\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_updated_at_idx\` ON \`product_filters\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_created_at_idx\` ON \`product_filters\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`product_filters_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`product_filters\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_filters_rels_order_idx\` ON \`product_filters_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_rels_parent_idx\` ON \`product_filters_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_rels_path_idx\` ON \`product_filters_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`product_filters_rels_categories_id_idx\` ON \`product_filters_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE TABLE \`products_filter_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tag\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_filter_tags_order_idx\` ON \`products_filter_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_filter_tags_parent_id_idx\` ON \`products_filter_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_filter_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tag\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_filter_tags_order_idx\` ON \`_products_v_version_filter_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_filter_tags_parent_id_idx\` ON \`_products_v_version_filter_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_search_search_fields\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_search_search_fields_order_idx\` ON \`site_settings_search_search_fields\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_search_search_fields_parent_idx\` ON \`site_settings_search_search_fields\` (\`parent_id\`);`)
  await db.run(sql`ALTER TABLE \`shipping_methods\` ADD \`free_above_subtotal\` numeric;`)
  await db.run(sql`ALTER TABLE \`shipping_methods\` ADD \`rules\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`discount_code\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`discount_amount\` numeric DEFAULT 0;`)
  await db.run(sql`CREATE INDEX \`orders_discount_code_idx\` ON \`orders\` (\`discount_code\`);`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_discount_code\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_discount_code_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_discount_amount\` numeric;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_discount_code\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_discount_code_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_discount_amount\` numeric;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`discount_codes_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`discount_codes_create\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`discount_codes_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`discount_codes_delete\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`product_filters_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`product_filters_create\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`product_filters_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`product_filters_delete\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`discount_codes_id\` integer REFERENCES discount_codes(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`product_filters_id\` integer REFERENCES product_filters(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_discount_codes_id_idx\` ON \`payload_locked_documents_rels\` (\`discount_codes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_product_filters_id_idx\` ON \`payload_locked_documents_rels\` (\`product_filters_id\`);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`search_placeholder\` text DEFAULT 'Hľadať produkty…';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`search_min_chars\` numeric DEFAULT 2;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`search_results_per_page\` numeric DEFAULT 12;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`discount_codes\`;`)
  await db.run(sql`DROP TABLE \`product_filters_options\`;`)
  await db.run(sql`DROP TABLE \`product_filters\`;`)
  await db.run(sql`DROP TABLE \`product_filters_rels\`;`)
  await db.run(sql`DROP TABLE \`products_filter_tags\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_filter_tags\`;`)
  await db.run(sql`DROP TABLE \`site_settings_search_search_fields\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`pages_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
  	\`shipping_methods_id\` integer,
  	\`payment_methods_id\` integer,
  	\`forms_id\` integer,
  	\`form_submissions_id\` integer,
  	\`addresses_id\` integer,
  	\`variants_id\` integer,
  	\`variant_types_id\` integer,
  	\`variant_options_id\` integer,
  	\`products_id\` integer,
  	\`carts_id\` integer,
  	\`orders_id\` integer,
  	\`transactions_id\` integer,
  	\`payload_mcp_api_keys_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`shipping_methods_id\`) REFERENCES \`shipping_methods\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`payment_methods_id\`) REFERENCES \`payment_methods\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`forms_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`form_submissions_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`addresses_id\`) REFERENCES \`addresses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`variants_id\`) REFERENCES \`variants\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`variant_types_id\`) REFERENCES \`variant_types\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`variant_options_id\`) REFERENCES \`variant_options\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`carts_id\`) REFERENCES \`carts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`transactions_id\`) REFERENCES \`transactions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`payload_mcp_api_keys_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "shipping_methods_id", "payment_methods_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "shipping_methods_id", "payment_methods_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_shipping_methods_id_idx\` ON \`payload_locked_documents_rels\` (\`shipping_methods_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payment_methods_id_idx\` ON \`payload_locked_documents_rels\` (\`payment_methods_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_forms_id_idx\` ON \`payload_locked_documents_rels\` (\`forms_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_form_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`form_submissions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_addresses_id_idx\` ON \`payload_locked_documents_rels\` (\`addresses_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_variants_id_idx\` ON \`payload_locked_documents_rels\` (\`variants_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_variant_types_id_idx\` ON \`payload_locked_documents_rels\` (\`variant_types_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_variant_options_id_idx\` ON \`payload_locked_documents_rels\` (\`variant_options_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_carts_id_idx\` ON \`payload_locked_documents_rels\` (\`carts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_transactions_id_idx\` ON \`payload_locked_documents_rels\` (\`transactions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payload_mcp_api_keys_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_mcp_api_keys_id\`);`)
  await db.run(sql`DROP INDEX \`orders_discount_code_idx\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`discount_code\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`discount_amount\`;`)
  await db.run(sql`ALTER TABLE \`shipping_methods\` DROP COLUMN \`free_above_subtotal\`;`)
  await db.run(sql`ALTER TABLE \`shipping_methods\` DROP COLUMN \`rules\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_discount_code\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_discount_code_i_d\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_discount_amount\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_discount_code\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_discount_code_i_d\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_discount_amount\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`discount_codes_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`discount_codes_create\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`discount_codes_update\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`discount_codes_delete\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`product_filters_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`product_filters_create\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`product_filters_update\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`product_filters_delete\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`search_placeholder\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`search_min_chars\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`search_results_per_page\`;`)
}
