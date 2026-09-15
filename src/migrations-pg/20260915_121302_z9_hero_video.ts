import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_homepage_hero_slides_media_type" AS ENUM('image', 'video');
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD COLUMN "media_type" "zapletane"."enum_homepage_hero_slides_media_type" DEFAULT 'image';
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD COLUMN "video_id" integer;
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD COLUMN "video_poster_id" integer;
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD CONSTRAINT "homepage_hero_slides_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD CONSTRAINT "homepage_hero_slides_video_poster_id_media_id_fk" FOREIGN KEY ("video_poster_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "homepage_hero_slides_video_idx" ON "zapletane"."homepage_hero_slides" USING btree ("video_id");
  CREATE INDEX "homepage_hero_slides_video_poster_idx" ON "zapletane"."homepage_hero_slides" USING btree ("video_poster_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."homepage_hero_slides" DROP CONSTRAINT "homepage_hero_slides_video_id_media_id_fk";
  
  ALTER TABLE "zapletane"."homepage_hero_slides" DROP CONSTRAINT "homepage_hero_slides_video_poster_id_media_id_fk";
  
  DROP INDEX "zapletane"."homepage_hero_slides_video_idx";
  DROP INDEX "zapletane"."homepage_hero_slides_video_poster_idx";
  ALTER TABLE "zapletane"."homepage_hero_slides" DROP COLUMN "media_type";
  ALTER TABLE "zapletane"."homepage_hero_slides" DROP COLUMN "video_id";
  ALTER TABLE "zapletane"."homepage_hero_slides" DROP COLUMN "video_poster_id";
  DROP TYPE "zapletane"."enum_homepage_hero_slides_media_type";`)
}
