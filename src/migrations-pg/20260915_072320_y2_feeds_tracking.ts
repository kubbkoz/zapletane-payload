import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_feed_settings_attribute_mappings_feed_attribute" AS ENUM('g:material', 'g:color', 'g:size', 'g:pattern', 'g:age_group', 'g:gender', 'g:custom_label_0', 'g:custom_label_1', 'g:custom_label_2', 'g:custom_label_3', 'g:custom_label_4', 'g:product_length', 'g:product_width', 'g:product_height', 'g:product_weight', 'g:mpn', 'g:gtin', 'custom');
  CREATE TYPE "zapletane"."enum_feed_settings_attribute_mappings_source" AS ENUM('property', 'dimensions.width', 'dimensions.height', 'dimensions.depth', 'dimensions.weight', 'filterTags', 'static');
  CREATE TYPE "zapletane"."enum_feed_settings_defaults_condition" AS ENUM('new', 'refurbished', 'used');
  CREATE TABLE "zapletane"."feed_settings_attribute_mappings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feed_attribute" "zapletane"."enum_feed_settings_attribute_mappings_feed_attribute" NOT NULL,
  	"source" "zapletane"."enum_feed_settings_attribute_mappings_source" NOT NULL,
  	"custom_attribute" varchar,
  	"property_id" integer,
  	"static_value" varchar
  );
  
  CREATE TABLE "zapletane"."feed_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"defaults_brand" varchar DEFAULT 'ZAPLETANE',
  	"defaults_condition" "zapletane"."enum_feed_settings_defaults_condition" DEFAULT 'new',
  	"defaults_google_product_category" varchar,
  	"defaults_shipping_country" varchar DEFAULT 'SK',
  	"defaults_shipping_price_override" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "feed_settings_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "feed_settings_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "marketing_head_scripts" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "marketing_body_start_scripts" varchar;
  ALTER TABLE "zapletane"."feed_settings_attribute_mappings" ADD CONSTRAINT "feed_settings_attribute_mappings_property_id_product_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "zapletane"."product_properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."feed_settings_attribute_mappings" ADD CONSTRAINT "feed_settings_attribute_mappings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."feed_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "feed_settings_attribute_mappings_order_idx" ON "zapletane"."feed_settings_attribute_mappings" USING btree ("_order");
  CREATE INDEX "feed_settings_attribute_mappings_parent_id_idx" ON "zapletane"."feed_settings_attribute_mappings" USING btree ("_parent_id");
  CREATE INDEX "feed_settings_attribute_mappings_property_idx" ON "zapletane"."feed_settings_attribute_mappings" USING btree ("property_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "zapletane"."feed_settings_attribute_mappings" CASCADE;
  DROP TABLE "zapletane"."feed_settings" CASCADE;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "feed_settings_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "feed_settings_update";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "marketing_head_scripts";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "marketing_body_start_scripts";
  DROP TYPE "zapletane"."enum_feed_settings_attribute_mappings_feed_attribute";
  DROP TYPE "zapletane"."enum_feed_settings_attribute_mappings_source";
  DROP TYPE "zapletane"."enum_feed_settings_defaults_condition";`)
}
