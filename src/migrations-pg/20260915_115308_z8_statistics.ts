import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "zapletane"."statistiky" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_placeholder" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "statistiky_find" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "zapletane"."statistiky" CASCADE;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "statistiky_find";`)
}
