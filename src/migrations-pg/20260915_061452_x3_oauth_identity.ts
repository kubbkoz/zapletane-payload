import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_users_oauth_provider" AS ENUM('google', 'facebook');
  ALTER TABLE "zapletane"."users" ADD COLUMN "oauth_provider" "zapletane"."enum_users_oauth_provider";
  ALTER TABLE "zapletane"."users" ADD COLUMN "oauth_sub" varchar;
  CREATE INDEX "users_oauth_sub_idx" ON "zapletane"."users" USING btree ("oauth_sub");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "zapletane"."users_oauth_sub_idx";
  ALTER TABLE "zapletane"."users" DROP COLUMN "oauth_provider";
  ALTER TABLE "zapletane"."users" DROP COLUMN "oauth_sub";
  DROP TYPE "zapletane"."enum_users_oauth_provider";`)
}
