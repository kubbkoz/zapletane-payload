import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_header_top_bar_mode" AS ENUM('contact', 'marquee');
  CREATE TYPE "zapletane"."enum_header_top_bar_marquee_speed" AS ENUM('slow', 'normal', 'fast');
  ALTER TABLE "zapletane"."header" ADD COLUMN "top_bar_enabled" boolean DEFAULT true;
  ALTER TABLE "zapletane"."header" ADD COLUMN "top_bar_mode" "zapletane"."enum_header_top_bar_mode" DEFAULT 'contact';
  ALTER TABLE "zapletane"."header" ADD COLUMN "top_bar_marquee_text" varchar DEFAULT 'Remeselná práca s láskou — doprava po celom Slovensku';
  ALTER TABLE "zapletane"."header" ADD COLUMN "top_bar_marquee_speed" "zapletane"."enum_header_top_bar_marquee_speed" DEFAULT 'normal';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."header" DROP COLUMN "top_bar_enabled";
  ALTER TABLE "zapletane"."header" DROP COLUMN "top_bar_mode";
  ALTER TABLE "zapletane"."header" DROP COLUMN "top_bar_marquee_text";
  ALTER TABLE "zapletane"."header" DROP COLUMN "top_bar_marquee_speed";
  DROP TYPE "zapletane"."enum_header_top_bar_mode";
  DROP TYPE "zapletane"."enum_header_top_bar_marquee_speed";`)
}
