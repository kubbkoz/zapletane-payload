import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "zapletane"."product_properties_predefined_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "zapletane"."product_properties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"unit" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zapletane"."products_properties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"property_id" integer,
  	"value" varchar
  );
  
  CREATE TABLE "zapletane"."_products_v_version_properties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "zapletane"."products" ADD COLUMN "dimensions_width" numeric;
  ALTER TABLE "zapletane"."products" ADD COLUMN "dimensions_height" numeric;
  ALTER TABLE "zapletane"."products" ADD COLUMN "dimensions_depth" numeric;
  ALTER TABLE "zapletane"."products" ADD COLUMN "dimensions_weight" numeric;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_dimensions_width" numeric;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_dimensions_height" numeric;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_dimensions_depth" numeric;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_dimensions_weight" numeric;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_properties_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_properties_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_properties_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "product_properties_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "product_properties_id" integer;
  ALTER TABLE "zapletane"."product_properties_predefined_values" ADD CONSTRAINT "product_properties_predefined_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."product_properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."products_properties" ADD CONSTRAINT "products_properties_property_id_product_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "zapletane"."product_properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."products_properties" ADD CONSTRAINT "products_properties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."_products_v_version_properties" ADD CONSTRAINT "_products_v_version_properties_property_id_product_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "zapletane"."product_properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."_products_v_version_properties" ADD CONSTRAINT "_products_v_version_properties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "product_properties_predefined_values_order_idx" ON "zapletane"."product_properties_predefined_values" USING btree ("_order");
  CREATE INDEX "product_properties_predefined_values_parent_id_idx" ON "zapletane"."product_properties_predefined_values" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "product_properties_name_idx" ON "zapletane"."product_properties" USING btree ("name");
  CREATE UNIQUE INDEX "product_properties_slug_idx" ON "zapletane"."product_properties" USING btree ("slug");
  CREATE INDEX "product_properties_updated_at_idx" ON "zapletane"."product_properties" USING btree ("updated_at");
  CREATE INDEX "product_properties_created_at_idx" ON "zapletane"."product_properties" USING btree ("created_at");
  CREATE INDEX "products_properties_order_idx" ON "zapletane"."products_properties" USING btree ("_order");
  CREATE INDEX "products_properties_parent_id_idx" ON "zapletane"."products_properties" USING btree ("_parent_id");
  CREATE INDEX "products_properties_property_idx" ON "zapletane"."products_properties" USING btree ("property_id");
  CREATE INDEX "_products_v_version_properties_order_idx" ON "zapletane"."_products_v_version_properties" USING btree ("_order");
  CREATE INDEX "_products_v_version_properties_parent_id_idx" ON "zapletane"."_products_v_version_properties" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_properties_property_idx" ON "zapletane"."_products_v_version_properties" USING btree ("property_id");
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_properties_fk" FOREIGN KEY ("product_properties_id") REFERENCES "zapletane"."product_properties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_product_properties_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("product_properties_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."product_properties_predefined_values" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."product_properties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."products_properties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."_products_v_version_properties" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."product_properties_predefined_values" CASCADE;
  DROP TABLE "zapletane"."product_properties" CASCADE;
  DROP TABLE "zapletane"."products_properties" CASCADE;
  DROP TABLE "zapletane"."_products_v_version_properties" CASCADE;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_properties_fk";
  
  DROP INDEX "zapletane"."payload_locked_documents_rels_product_properties_id_idx";
  ALTER TABLE "zapletane"."products" DROP COLUMN "dimensions_width";
  ALTER TABLE "zapletane"."products" DROP COLUMN "dimensions_height";
  ALTER TABLE "zapletane"."products" DROP COLUMN "dimensions_depth";
  ALTER TABLE "zapletane"."products" DROP COLUMN "dimensions_weight";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_dimensions_width";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_dimensions_height";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_dimensions_depth";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_dimensions_weight";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_properties_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_properties_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_properties_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "product_properties_delete";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "product_properties_id";`)
}
