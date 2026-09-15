import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_scraper_jobs_status" AS ENUM('new', 'preview_running', 'awaiting_confirm', 'importing', 'done', 'failed');
  CREATE TABLE "zapletane"."scraper_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_url" varchar NOT NULL,
  	"status" "zapletane"."enum_scraper_jobs_status" DEFAULT 'new',
  	"detected_language" varchar,
  	"fallback_rate" numeric DEFAULT 4.3,
  	"batch_size" numeric DEFAULT 5,
  	"max_products" numeric DEFAULT 500,
  	"counters_discovered" numeric DEFAULT 0,
  	"counters_imported" numeric DEFAULT 0,
  	"counters_skipped" numeric DEFAULT 0,
  	"counters_failed" numeric DEFAULT 0,
  	"previews" jsonb,
  	"log" varchar,
  	"product_links" jsonb,
  	"cursor" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "zapletane"."products" ADD COLUMN "import_source_url" varchar;
  ALTER TABLE "zapletane"."products" ADD COLUMN "import_source_external_id" varchar;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_import_source_url" varchar;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_import_source_external_id" varchar;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "scraper_jobs_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "scraper_jobs_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "scraper_jobs_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "scraper_jobs_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "scraper_jobs_id" integer;
  CREATE INDEX "scraper_jobs_status_idx" ON "zapletane"."scraper_jobs" USING btree ("status");
  CREATE INDEX "scraper_jobs_updated_at_idx" ON "zapletane"."scraper_jobs" USING btree ("updated_at");
  CREATE INDEX "scraper_jobs_created_at_idx" ON "zapletane"."scraper_jobs" USING btree ("created_at");
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scraper_jobs_fk" FOREIGN KEY ("scraper_jobs_id") REFERENCES "zapletane"."scraper_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_import_source_import_source_url_idx" ON "zapletane"."products" USING btree ("import_source_url");
  CREATE INDEX "_products_v_version_import_source_version_import_source__idx" ON "zapletane"."_products_v" USING btree ("version_import_source_url");
  CREATE INDEX "payload_locked_documents_rels_scraper_jobs_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("scraper_jobs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."scraper_jobs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."scraper_jobs" CASCADE;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scraper_jobs_fk";
  
  DROP INDEX "zapletane"."products_import_source_import_source_url_idx";
  DROP INDEX "zapletane"."_products_v_version_import_source_version_import_source__idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_scraper_jobs_id_idx";
  ALTER TABLE "zapletane"."products" DROP COLUMN "import_source_url";
  ALTER TABLE "zapletane"."products" DROP COLUMN "import_source_external_id";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_import_source_url";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_import_source_external_id";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "scraper_jobs_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "scraper_jobs_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "scraper_jobs_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "scraper_jobs_delete";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "scraper_jobs_id";
  DROP TYPE "zapletane"."enum_scraper_jobs_status";`)
}
