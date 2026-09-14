import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "zapletane"."site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coming_soon_enabled" boolean DEFAULT true,
  	"coming_soon_eyebrow" varchar DEFAULT 'Čoskoro spúšťame',
  	"coming_soon_title" varchar DEFAULT 'Pripravujeme
  pre vás obchod',
  	"coming_soon_body" varchar DEFAULT 'Ručne pletené dekorácie, deky a hračky aj prútené dekorácie — poctivá ručná výroba, ktorá zahreje a poteší. Práve dokončujeme posledné kúsky a už čoskoro sme online.',
  	"coming_soon_note" varchar DEFAULT 'Medzitým nám pokojne napíšte alebo zavolajte — radi poradíme.',
  	"coming_soon_phone" varchar DEFAULT '+421 915 675 870',
  	"coming_soon_email" varchar DEFAULT 'info@zapletane.sk',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "site_settings_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "site_settings_update" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "zapletane"."site_settings" CASCADE;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "site_settings_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "site_settings_update";`)
}
