import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`push_subscriptions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`customer_id\` integer NOT NULL,
  	\`endpoint\` text NOT NULL,
  	\`keys_p256dh\` text NOT NULL,
  	\`keys_auth\` text NOT NULL,
  	\`user_agent\` text,
  	\`last_seen_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`push_subscriptions_customer_idx\` ON \`push_subscriptions\` (\`customer_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`push_subscriptions_endpoint_idx\` ON \`push_subscriptions\` (\`endpoint\`);`)
  await db.run(sql`CREATE INDEX \`push_subscriptions_updated_at_idx\` ON \`push_subscriptions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`push_subscriptions_created_at_idx\` ON \`push_subscriptions\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`addresses\` ADD \`kind\` text;`)
  await db.run(sql`CREATE INDEX \`addresses_kind_idx\` ON \`addresses\` (\`kind\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`push_subscriptions_id\` integer REFERENCES push_subscriptions(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_push_subscriptions_id_idx\` ON \`payload_locked_documents_rels\` (\`push_subscriptions_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`push_subscriptions\`;`)
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
  	\`discount_codes_id\` integer,
  	\`product_filters_id\` integer,
  	\`product_properties_id\` integer,
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
  	FOREIGN KEY (\`discount_codes_id\`) REFERENCES \`discount_codes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_filters_id\`) REFERENCES \`product_filters\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_properties_id\`) REFERENCES \`product_properties\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "shipping_methods_id", "payment_methods_id", "discount_codes_id", "product_filters_id", "product_properties_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "users_id", "pages_id", "categories_id", "media_id", "shipping_methods_id", "payment_methods_id", "discount_codes_id", "product_filters_id", "product_properties_id", "forms_id", "form_submissions_id", "addresses_id", "variants_id", "variant_types_id", "variant_options_id", "products_id", "carts_id", "orders_id", "transactions_id", "payload_mcp_api_keys_id" FROM \`payload_locked_documents_rels\`;`)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_discount_codes_id_idx\` ON \`payload_locked_documents_rels\` (\`discount_codes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_product_filters_id_idx\` ON \`payload_locked_documents_rels\` (\`product_filters_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_product_properties_id_idx\` ON \`payload_locked_documents_rels\` (\`product_properties_id\`);`)
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
  await db.run(sql`DROP INDEX \`addresses_kind_idx\`;`)
  await db.run(sql`ALTER TABLE \`addresses\` DROP COLUMN \`kind\`;`)
}
