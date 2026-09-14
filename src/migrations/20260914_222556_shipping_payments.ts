import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`shipping_methods\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`price\` numeric DEFAULT 0 NOT NULL,
  	\`type\` text DEFAULT 'courier' NOT NULL,
  	\`delivery_estimate\` text,
  	\`enabled\` integer DEFAULT true,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`shipping_methods_updated_at_idx\` ON \`shipping_methods\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`shipping_methods_created_at_idx\` ON \`shipping_methods\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payment_methods\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`type\` text DEFAULT 'cod' NOT NULL,
  	\`surcharge\` numeric DEFAULT 0 NOT NULL,
  	\`gateway\` text DEFAULT 'comgate',
  	\`description\` text,
  	\`instructions\` text,
  	\`enabled\` integer DEFAULT true,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payment_methods_updated_at_idx\` ON \`payment_methods\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payment_methods_created_at_idx\` ON \`payment_methods\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_method_id\` integer REFERENCES shipping_methods(id);`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`payment_type\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_fee\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`cod_fee\` numeric DEFAULT 0;`)
  await db.run(sql`CREATE INDEX \`orders_shipping_method_idx\` ON \`orders\` (\`shipping_method_id\`);`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_payment_type\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_shipping_method_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_shipping_fee\` numeric;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_cod_fee\` numeric;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`manual_shipping_address_snapshot\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_trans_id\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_ref_id\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_payment_type\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_shipping_method_i_d\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_shipping_fee\` numeric;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_cod_fee\` numeric;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`comgate_shipping_address_snapshot\` text;`)
  await db.run(sql`CREATE INDEX \`transactions_comgate_comgate_trans_id_idx\` ON \`transactions\` (\`comgate_trans_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`shipping_methods_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`shipping_methods_create\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`shipping_methods_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`shipping_methods_delete\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`payment_methods_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`payment_methods_create\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`payment_methods_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`payment_methods_delete\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`shipping_methods_id\` integer REFERENCES shipping_methods(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payment_methods_id\` integer REFERENCES payment_methods(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_shipping_methods_id_idx\` ON \`payload_locked_documents_rels\` (\`shipping_methods_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payment_methods_id_idx\` ON \`payload_locked_documents_rels\` (\`payment_methods_id\`);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`payments_bank_account_holder\` text DEFAULT 'ZAPLETANE';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`payments_iban\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`payments_swift\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`payments_bank_name\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`payments_variable_symbol_note\` text DEFAULT 'Ako variabilný symbol uveďte číslo objednávky. Tovar expedujeme po pripísaní platby na účet.';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`shipping_methods\`;`)
  await db.run(sql`DROP TABLE \`payment_methods\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_orders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`shipping_address_title\` text,
  	\`shipping_address_first_name\` text,
  	\`shipping_address_last_name\` text,
  	\`shipping_address_company\` text,
  	\`shipping_address_address_line1\` text,
  	\`shipping_address_address_line2\` text,
  	\`shipping_address_city\` text,
  	\`shipping_address_state\` text,
  	\`shipping_address_postal_code\` text,
  	\`shipping_address_country\` text,
  	\`shipping_address_phone\` text,
  	\`customer_id\` integer,
  	\`customer_email\` text,
  	\`status\` text DEFAULT 'processing',
  	\`amount\` numeric,
  	\`currency\` text DEFAULT 'EUR',
  	\`access_token\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_orders\`("id", "shipping_address_title", "shipping_address_first_name", "shipping_address_last_name", "shipping_address_company", "shipping_address_address_line1", "shipping_address_address_line2", "shipping_address_city", "shipping_address_state", "shipping_address_postal_code", "shipping_address_country", "shipping_address_phone", "customer_id", "customer_email", "status", "amount", "currency", "access_token", "updated_at", "created_at") SELECT "id", "shipping_address_title", "shipping_address_first_name", "shipping_address_last_name", "shipping_address_company", "shipping_address_address_line1", "shipping_address_address_line2", "shipping_address_city", "shipping_address_state", "shipping_address_postal_code", "shipping_address_country", "shipping_address_phone", "customer_id", "customer_email", "status", "amount", "currency", "access_token", "updated_at", "created_at" FROM \`orders\`;`)
  await db.run(sql`DROP TABLE \`orders\`;`)
  await db.run(sql`ALTER TABLE \`__new_orders\` RENAME TO \`orders\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`orders_customer_idx\` ON \`orders\` (\`customer_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_access_token_idx\` ON \`orders\` (\`access_token\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`pages_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
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
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
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
  await db.run(sql`DROP INDEX \`transactions_comgate_comgate_trans_id_idx\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_payment_type\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_shipping_method_i_d\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_shipping_fee\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_cod_fee\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`manual_shipping_address_snapshot\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_trans_id\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_ref_id\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_payment_type\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_shipping_method_i_d\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_shipping_fee\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_cod_fee\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`comgate_shipping_address_snapshot\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`shipping_methods_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`shipping_methods_create\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`shipping_methods_update\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`shipping_methods_delete\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`payment_methods_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`payment_methods_create\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`payment_methods_update\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`payment_methods_delete\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`payments_bank_account_holder\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`payments_iban\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`payments_swift\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`payments_bank_name\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`payments_variable_symbol_note\`;`)
}
