import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * W1 — doprava a platby. Generated offline per docs/AGENT-ROADMAP.md
 * ("Operatívne pravidlá" §1) and purely additive: two new tables
 * (shipping_methods, payment_methods), new columns on orders / transactions /
 * site_settings / payload_mcp_api_keys, and two new values on the transactions
 * payment-method enum for the `manual` and `comgate` adapters. Nothing is
 * renamed or dropped, so no interactive drizzle prompt was involved.
 *
 * `ALTER TYPE ... ADD VALUE` inside a transaction requires PostgreSQL 12+
 * (Neon is well past that). The new values are only added here, never used in
 * the same transaction, which is the other half of that restriction.
 *
 * The MCP key checkboxes this adds all default to false; the follow-up data
 * migration `20260914_223000_mcp_shipping_payment_grants` turns them on for the
 * production key.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_shipping_methods_type" AS ENUM('courier', 'pickupPoint', 'personal');
  CREATE TYPE "zapletane"."enum_payment_methods_type" AS ENUM('cod', 'bankTransfer', 'card');
  CREATE TYPE "zapletane"."enum_payment_methods_gateway" AS ENUM('comgate', 'stripe');
  CREATE TYPE "zapletane"."enum_orders_payment_type" AS ENUM('cod', 'bankTransfer', 'card');
  ALTER TYPE "zapletane"."enum_transactions_payment_method" ADD VALUE 'manual' BEFORE 'stripe';
  ALTER TYPE "zapletane"."enum_transactions_payment_method" ADD VALUE 'comgate' BEFORE 'stripe';
  CREATE TABLE "zapletane"."shipping_methods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric DEFAULT 0 NOT NULL,
  	"type" "zapletane"."enum_shipping_methods_type" DEFAULT 'courier' NOT NULL,
  	"delivery_estimate" varchar,
  	"enabled" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "zapletane"."payment_methods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "zapletane"."enum_payment_methods_type" DEFAULT 'cod' NOT NULL,
  	"surcharge" numeric DEFAULT 0 NOT NULL,
  	"gateway" "zapletane"."enum_payment_methods_gateway" DEFAULT 'comgate',
  	"description" varchar,
  	"instructions" jsonb,
  	"enabled" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "zapletane"."orders" ADD COLUMN "shipping_method_id" integer;
  ALTER TABLE "zapletane"."orders" ADD COLUMN "payment_type" "zapletane"."enum_orders_payment_type";
  ALTER TABLE "zapletane"."orders" ADD COLUMN "shipping_fee" numeric DEFAULT 0;
  ALTER TABLE "zapletane"."orders" ADD COLUMN "cod_fee" numeric DEFAULT 0;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_payment_type" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_shipping_method_i_d" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_shipping_fee" numeric;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_cod_fee" numeric;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "manual_shipping_address_snapshot" jsonb;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_trans_id" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_ref_id" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_payment_type" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_shipping_method_i_d" varchar;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_shipping_fee" numeric;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_cod_fee" numeric;
  ALTER TABLE "zapletane"."transactions" ADD COLUMN "comgate_shipping_address_snapshot" jsonb;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "shipping_methods_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "shipping_methods_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "shipping_methods_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "shipping_methods_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "payment_methods_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "payment_methods_create" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "payment_methods_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "payment_methods_delete" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "shipping_methods_id" integer;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD COLUMN "payment_methods_id" integer;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "payments_bank_account_holder" varchar DEFAULT 'ZAPLETANE';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "payments_iban" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "payments_swift" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "payments_bank_name" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "payments_variable_symbol_note" varchar DEFAULT 'Ako variabilný symbol uveďte číslo objednávky. Tovar expedujeme po pripísaní platby na účet.';
  CREATE INDEX "shipping_methods_updated_at_idx" ON "zapletane"."shipping_methods" USING btree ("updated_at");
  CREATE INDEX "shipping_methods_created_at_idx" ON "zapletane"."shipping_methods" USING btree ("created_at");
  CREATE INDEX "payment_methods_updated_at_idx" ON "zapletane"."payment_methods" USING btree ("updated_at");
  CREATE INDEX "payment_methods_created_at_idx" ON "zapletane"."payment_methods" USING btree ("created_at");
  ALTER TABLE "zapletane"."orders" ADD CONSTRAINT "orders_shipping_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "zapletane"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipping_methods_fk" FOREIGN KEY ("shipping_methods_id") REFERENCES "zapletane"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_methods_fk" FOREIGN KEY ("payment_methods_id") REFERENCES "zapletane"."payment_methods"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_shipping_method_idx" ON "zapletane"."orders" USING btree ("shipping_method_id");
  CREATE INDEX "transactions_comgate_comgate_trans_id_idx" ON "zapletane"."transactions" USING btree ("comgate_trans_id");
  CREATE INDEX "payload_locked_documents_rels_shipping_methods_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("shipping_methods_id");
  CREATE INDEX "payload_locked_documents_rels_payment_methods_id_idx" ON "zapletane"."payload_locked_documents_rels" USING btree ("payment_methods_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."shipping_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "zapletane"."payment_methods" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "zapletane"."shipping_methods" CASCADE;
  DROP TABLE "zapletane"."payment_methods" CASCADE;
  ALTER TABLE "zapletane"."orders" DROP CONSTRAINT "orders_shipping_method_id_shipping_methods_id_fk";
  
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_shipping_methods_fk";
  
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payment_methods_fk";
  
  ALTER TABLE "zapletane"."transactions" ALTER COLUMN "payment_method" SET DATA TYPE text;
  DROP TYPE "zapletane"."enum_transactions_payment_method";
  CREATE TYPE "zapletane"."enum_transactions_payment_method" AS ENUM('stripe');
  ALTER TABLE "zapletane"."transactions" ALTER COLUMN "payment_method" SET DATA TYPE "zapletane"."enum_transactions_payment_method" USING "payment_method"::"zapletane"."enum_transactions_payment_method";
  DROP INDEX "zapletane"."orders_shipping_method_idx";
  DROP INDEX "zapletane"."transactions_comgate_comgate_trans_id_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_shipping_methods_id_idx";
  DROP INDEX "zapletane"."payload_locked_documents_rels_payment_methods_id_idx";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "shipping_method_id";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "payment_type";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "shipping_fee";
  ALTER TABLE "zapletane"."orders" DROP COLUMN "cod_fee";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_payment_type";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_shipping_method_i_d";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_shipping_fee";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_cod_fee";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "manual_shipping_address_snapshot";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_trans_id";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_ref_id";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_payment_type";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_shipping_method_i_d";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_shipping_fee";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_cod_fee";
  ALTER TABLE "zapletane"."transactions" DROP COLUMN "comgate_shipping_address_snapshot";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "shipping_methods_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "shipping_methods_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "shipping_methods_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "shipping_methods_delete";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "payment_methods_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "payment_methods_create";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "payment_methods_update";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "payment_methods_delete";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "shipping_methods_id";
  ALTER TABLE "zapletane"."payload_locked_documents_rels" DROP COLUMN "payment_methods_id";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "payments_bank_account_holder";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "payments_iban";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "payments_swift";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "payments_bank_name";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "payments_variable_symbol_note";
  DROP TYPE "zapletane"."enum_shipping_methods_type";
  DROP TYPE "zapletane"."enum_payment_methods_type";
  DROP TYPE "zapletane"."enum_payment_methods_gateway";
  DROP TYPE "zapletane"."enum_orders_payment_type";`)
}
