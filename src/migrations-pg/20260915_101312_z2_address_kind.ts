import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_addresses_kind" AS ENUM('billing', 'shipping');
  CREATE TABLE "zapletane"."push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"keys_p256dh" varchar NOT NULL,
  	"keys_auth" varchar NOT NULL,
  	"user_agent" varchar,
  	"last_seen_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "zapletane"."addresses" ADD COLUMN "kind" "zapletane"."enum_addresses_kind";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "zapletane"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "zapletane"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "push_subscriptions_customer_idx" ON "zapletane"."push_subscriptions" USING btree ("customer_id");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "zapletane"."push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "zapletane"."push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "zapletane"."push_subscriptions" USING btree ("created_at");
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "zapletane"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "addresses_kind_idx" ON "zapletane"."addresses" USING btree ("kind");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("push_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."push_subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."push_subscriptions" CASCADE;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk";
  
  DROP INDEX "zapletane"."addresses_kind_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_push_subscriptions_id_idx";
  ALTER TABLE "zapletane"."addresses" DROP COLUMN "kind";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "push_subscriptions_id";
  DROP TYPE "zapletane"."enum_addresses_kind";`)
}
