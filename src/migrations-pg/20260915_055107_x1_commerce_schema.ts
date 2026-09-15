import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_discount_codes_type" AS ENUM('percent', 'fixed');
  CREATE TYPE "zapletane"."enum_product_filters_type" AS ENUM('tags', 'categories', 'price', 'availability');
  CREATE TYPE "zapletane"."enum_site_settings_search_search_fields" AS ENUM('title', 'description', 'categories');
  CREATE TABLE "zapletane"."discount_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"type" "zapletane"."enum_discount_codes_type" DEFAULT 'percent' NOT NULL,
  	"value" numeric NOT NULL,
  	"min_subtotal" numeric,
  	"valid_from" timestamp(3) with time zone,
  	"valid_until" timestamp(3) with time zone,
  	"max_uses" numeric,
  	"used_count" numeric DEFAULT 0,
  	"enabled" boolean DEFAULT true,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zapletane"."product_filters_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "zapletane"."product_filters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "zapletane"."enum_product_filters_type" DEFAULT 'tags' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zapletane"."product_filters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "zapletane"."products_filter_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "zapletane"."_products_v_version_filter_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "zapletane"."site_settings_search_search_fields" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "zapletane"."enum_site_settings_search_search_fields",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "zapletane"."shipping_methods" ADD COLUMN "free_above_subtotal" numeric;
  ALTER TABLE "zapletane"."shipping_methods" ADD COLUMN "rules" varchar;
  ALTER TABLE "zapletane"."orders" ADD COLUMN "discount_code" varchar;
  ALTER TABLE "zapletane"."orders" ADD COLUMN "discount_amount" numeric DEFAULT 0;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_discount_code" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_discount_code_i_d" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_discount_amount" numeric;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_discount_code" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_discount_code_i_d" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_discount_amount" numeric;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "discount_codes_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "discount_codes_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "discount_codes_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "discount_codes_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_filters_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_filters_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_filters_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_filters_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "discount_codes_id" integer;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "product_filters_id" integer;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "search_placeholder" varchar DEFAULT 'Hľadať produkty…';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "search_min_chars" numeric DEFAULT 2;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "search_results_per_page" numeric DEFAULT 12;
  ALTER TABLE "zapletane"."product_filters_options" ADD CONSTRAINT "product_filters_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."product_filters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."product_filters_rels" ADD CONSTRAINT "product_filters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."product_filters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."product_filters_rels" ADD CONSTRAINT "product_filters_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "zapletane"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."products_filter_tags" ADD CONSTRAINT "products_filter_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."_products_v_version_filter_tags" ADD CONSTRAINT "_products_v_version_filter_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."site_settings_search_search_fields" ADD CONSTRAINT "site_settings_search_search_fields_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "discount_codes_code_idx" ON "zapletane"."discount_codes" USING btree ("code");
  CREATE INDEX "discount_codes_updated_at_idx" ON "zapletane"."discount_codes" USING btree ("updated_at");
  CREATE INDEX "discount_codes_created_at_idx" ON "zapletane"."discount_codes" USING btree ("created_at");
  CREATE INDEX "product_filters_options_order_idx" ON "zapletane"."product_filters_options" USING btree ("_order");
  CREATE INDEX "product_filters_options_parent_id_idx" ON "zapletane"."product_filters_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "product_filters_slug_idx" ON "zapletane"."product_filters" USING btree ("slug");
  CREATE INDEX "product_filters_updated_at_idx" ON "zapletane"."product_filters" USING btree ("updated_at");
  CREATE INDEX "product_filters_created_at_idx" ON "zapletane"."product_filters" USING btree ("created_at");
  CREATE INDEX "product_filters_rels_order_idx" ON "zapletane"."product_filters_rels" USING btree ("order");
  CREATE INDEX "product_filters_rels_parent_idx" ON "zapletane"."product_filters_rels" USING btree ("parent_id");
  CREATE INDEX "product_filters_rels_path_idx" ON "zapletane"."product_filters_rels" USING btree ("path");
  CREATE INDEX "product_filters_rels_categories_id_idx" ON "zapletane"."product_filters_rels" USING btree ("categories_id");
  CREATE INDEX "products_filter_tags_order_idx" ON "zapletane"."products_filter_tags" USING btree ("_order");
  CREATE INDEX "products_filter_tags_parent_id_idx" ON "zapletane"."products_filter_tags" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_filter_tags_order_idx" ON "zapletane"."_products_v_version_filter_tags" USING btree ("_order");
  CREATE INDEX "_products_v_version_filter_tags_parent_id_idx" ON "zapletane"."_products_v_version_filter_tags" USING btree ("_parent_id");
  CREATE INDEX "site_settings_search_search_fields_order_idx" ON "zapletane"."site_settings_search_search_fields" USING btree ("order");
  CREATE INDEX "site_settings_search_search_fields_parent_idx" ON "zapletane"."site_settings_search_search_fields" USING btree ("parent_id");
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discount_codes_fk" FOREIGN KEY ("discount_codes_id") REFERENCES "zapletane"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_filters_fk" FOREIGN KEY ("product_filters_id") REFERENCES "zapletane"."product_filters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_discount_code_idx" ON "zapletane"."orders" USING btree ("discount_code");
  CREATE INDEX "payload_locked_documents_rels_discount_codes_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("discount_codes_id");
  CREATE INDEX "payload_locked_documents_rels_product_filters_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("product_filters_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."discount_codes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."product_filters_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."product_filters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."product_filters_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."products_filter_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."_products_v_version_filter_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."site_settings_search_search_fields" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."discount_codes" CASCADE;
  DROP TABLE "zapletane"."product_filters_options" CASCADE;
  DROP TABLE "zapletane"."product_filters" CASCADE;
  DROP TABLE "zapletane"."product_filters_rels" CASCADE;
  DROP TABLE "zapletane"."products_filter_tags" CASCADE;
  DROP TABLE "zapletane"."_products_v_version_filter_tags" CASCADE;
  DROP TABLE "zapletane"."site_settings_search_search_fields" CASCADE;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discount_codes_fk";
  
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_filters_fk";
  
  DROP INDEX "zapletane"."orders_discount_code_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_discount_codes_id_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_product_filters_id_idx";
  ALTER TABLE "zapletane"."shipping_methods" DROP COLUMN "free_above_subtotal";
  ALTER TABLE "zapletane"."shipping_methods" DROP COLUMN "rules";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "discount_code";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "discount_amount";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_discount_code";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_discount_code_i_d";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_discount_amount";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_discount_code";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_discount_code_i_d";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_discount_amount";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "discount_codes_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "discount_codes_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "discount_codes_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "discount_codes_delete";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_filters_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_filters_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_filters_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_filters_delete";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "discount_codes_id";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "product_filters_id";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "search_placeholder";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "search_min_chars";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "search_results_per_page";
  DROP TYPE "zapletane"."enum_discount_codes_type";
  DROP TYPE "zapletane"."enum_product_filters_type";
  DROP TYPE "zapletane"."enum_site_settings_search_search_fields";`)
}
