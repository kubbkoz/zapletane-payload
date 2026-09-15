import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "zapletane"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "zapletane"."enum_redirects_to_type" AS ENUM('custom', 'reference');
  CREATE TABLE "zapletane"."posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"published_at" timestamp(3) with time zone,
  	"hero_image_id" integer,
  	"excerpt" varchar,
  	"content" jsonb,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"slug" varchar,
  	"slug_lock" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "zapletane"."enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "zapletane"."_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_hero_image_id" integer,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_slug" varchar,
  	"version_slug_lock" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "zapletane"."enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "zapletane"."redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to_type" "zapletane"."enum_redirects_to_type" DEFAULT 'custom',
  	"to_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zapletane"."redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "zapletane"."pages" ADD COLUMN "slug_lock" boolean DEFAULT false;
  ALTER TABLE "zapletane"."_pages_v" ADD COLUMN "version_slug_lock" boolean DEFAULT false;
  ALTER TABLE "zapletane"."categories" ADD COLUMN "slug_lock" boolean DEFAULT false;
  ALTER TABLE "zapletane"."products" ADD COLUMN "slug_lock" boolean DEFAULT false;
  ALTER TABLE "zapletane"."_products_v" ADD COLUMN "version_slug_lock" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "posts_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "posts_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "posts_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "posts_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "redirects_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "redirects_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "redirects_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "redirects_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "posts_id" integer;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "redirects_id" integer;
  ALTER TABLE "zapletane"."posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."redirects_rels" ADD CONSTRAINT "redirects_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "zapletane"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."redirects_rels" ADD CONSTRAINT "redirects_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "zapletane"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."redirects_rels" ADD CONSTRAINT "redirects_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "zapletane"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."redirects_rels" ADD CONSTRAINT "redirects_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "zapletane"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_published_at_idx" ON "zapletane"."posts" USING btree ("published_at");
  CREATE INDEX "posts_hero_image_idx" ON "zapletane"."posts" USING btree ("hero_image_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "zapletane"."posts" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "zapletane"."posts" USING btree ("slug");
  CREATE INDEX "posts_updated_at_idx" ON "zapletane"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "zapletane"."posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "zapletane"."posts" USING btree ("_status");
  CREATE INDEX "_posts_v_parent_idx" ON "zapletane"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_published_at_idx" ON "zapletane"."_posts_v" USING btree ("version_published_at");
  CREATE INDEX "_posts_v_version_version_hero_image_idx" ON "zapletane"."_posts_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "zapletane"."_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "zapletane"."_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "zapletane"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "zapletane"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "zapletane"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "zapletane"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "zapletane"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "zapletane"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "zapletane"."_posts_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "zapletane"."redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "zapletane"."redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "zapletane"."redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "zapletane"."redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "zapletane"."redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "zapletane"."redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_pages_id_idx" ON "zapletane"."redirects_rels" USING btree ("pages_id");
  CREATE INDEX "redirects_rels_posts_id_idx" ON "zapletane"."redirects_rels" USING btree ("posts_id");
  CREATE INDEX "redirects_rels_products_id_idx" ON "zapletane"."redirects_rels" USING btree ("products_id");
  CREATE INDEX "redirects_rels_categories_id_idx" ON "zapletane"."redirects_rels" USING btree ("categories_id");
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "zapletane"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "zapletane"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("redirects_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."redirects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."redirects_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."posts" CASCADE;
  DROP TABLE "zapletane"."_posts_v" CASCADE;
  DROP TABLE "zapletane"."redirects" CASCADE;
  DROP TABLE "zapletane"."redirects_rels" CASCADE;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_posts_fk";
  
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redirects_fk";
  
  DROP INDEX "zapletane"."payload_locked_documents_rels_posts_id_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_redirects_id_idx";
  ALTER TABLE "zapletane"."pages" DROP COLUMN "slug_lock";
  ALTER TABLE "zapletane"."_pages_v" DROP COLUMN "version_slug_lock";
  ALTER TABLE "zapletane"."categories" DROP COLUMN "slug_lock";
  ALTER TABLE "zapletane"."products" DROP COLUMN "slug_lock";
  ALTER TABLE "zapletane"."_products_v" DROP COLUMN "version_slug_lock";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "posts_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "posts_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "posts_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "posts_delete";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "redirects_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "redirects_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "redirects_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "redirects_delete";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "posts_id";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "redirects_id";
  DROP TYPE "zapletane"."enum_posts_status";
  DROP TYPE "zapletane"."enum__posts_v_version_status";
  DROP TYPE "zapletane"."enum_redirects_to_type";`)
}
