import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "zapletane"."users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "zapletane"."users" ADD COLUMN "wishlist_share_token" varchar;
  ALTER TABLE "zapletane"."users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."users_rels" ADD CONSTRAINT "users_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "zapletane"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_order_idx" ON "zapletane"."users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "zapletane"."users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "zapletane"."users_rels" USING btree ("path");
  CREATE INDEX "users_rels_products_id_idx" ON "zapletane"."users_rels" USING btree ("products_id");
  CREATE UNIQUE INDEX "users_wishlist_share_token_idx" ON "zapletane"."users" USING btree ("wishlist_share_token");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."users_rels" CASCADE;
  DROP INDEX "zapletane"."users_wishlist_share_token_idx";
  ALTER TABLE "zapletane"."users" DROP COLUMN "wishlist_share_token";`)
}
