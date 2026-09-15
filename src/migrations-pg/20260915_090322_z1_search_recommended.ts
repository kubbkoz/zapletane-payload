import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "zapletane"."site_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "zapletane"."site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "zapletane"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."site_settings_rels" ADD CONSTRAINT "site_settings_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "zapletane"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."site_settings_rels" ADD CONSTRAINT "site_settings_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "zapletane"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_rels_order_idx" ON "zapletane"."site_settings_rels" USING btree ("order");
  CREATE INDEX "site_settings_rels_parent_idx" ON "zapletane"."site_settings_rels" USING btree ("parent_id");
  CREATE INDEX "site_settings_rels_path_idx" ON "zapletane"."site_settings_rels" USING btree ("path");
  CREATE INDEX "site_settings_rels_products_id_idx" ON "zapletane"."site_settings_rels" USING btree ("products_id");
  CREATE INDEX "site_settings_rels_categories_id_idx" ON "zapletane"."site_settings_rels" USING btree ("categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "zapletane"."site_settings_rels" CASCADE;`)
}
