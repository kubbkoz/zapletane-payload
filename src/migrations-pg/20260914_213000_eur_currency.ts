import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Switch the shop currency from the template's USD to EUR.
 *
 * The ecommerce plugin derives its price field names from the configured
 * currency (`currencies.supportedCurrencies` in src/plugins/index.ts), so the
 * columns rename from price_in_u_s_d to price_in_e_u_r. Hand-written as
 * RENAMEs (drizzle's generator would emit interactive rename prompts and,
 * non-interactively, an add+drop pair that loses data): RENAME COLUMN keeps
 * every existing price, and ALTER TYPE ... RENAME VALUE rewrites 'USD' to
 * 'EUR' in-place for all existing carts/orders/transactions rows and their
 * column defaults. The paired snapshot JSON mirrors these renames so future
 * `payload migrate:create` diffs stay clean.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."products" RENAME COLUMN "price_in_u_s_d" TO "price_in_e_u_r";
   ALTER TABLE "zapletane"."products" RENAME COLUMN "price_in_u_s_d_enabled" TO "price_in_e_u_r_enabled";
   ALTER TABLE "zapletane"."_products_v" RENAME COLUMN "version_price_in_u_s_d" TO "version_price_in_e_u_r";
   ALTER TABLE "zapletane"."_products_v" RENAME COLUMN "version_price_in_u_s_d_enabled" TO "version_price_in_e_u_r_enabled";
   ALTER TABLE "zapletane"."variants" RENAME COLUMN "price_in_u_s_d" TO "price_in_e_u_r";
   ALTER TABLE "zapletane"."variants" RENAME COLUMN "price_in_u_s_d_enabled" TO "price_in_e_u_r_enabled";
   ALTER TABLE "zapletane"."_variants_v" RENAME COLUMN "version_price_in_u_s_d" TO "version_price_in_e_u_r";
   ALTER TABLE "zapletane"."_variants_v" RENAME COLUMN "version_price_in_u_s_d_enabled" TO "version_price_in_e_u_r_enabled";
   ALTER TYPE "zapletane"."enum_carts_currency" RENAME VALUE 'USD' TO 'EUR';
   ALTER TYPE "zapletane"."enum_orders_currency" RENAME VALUE 'USD' TO 'EUR';
   ALTER TYPE "zapletane"."enum_transactions_currency" RENAME VALUE 'USD' TO 'EUR';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."products" RENAME COLUMN "price_in_e_u_r" TO "price_in_u_s_d";
   ALTER TABLE "zapletane"."products" RENAME COLUMN "price_in_e_u_r_enabled" TO "price_in_u_s_d_enabled";
   ALTER TABLE "zapletane"."_products_v" RENAME COLUMN "version_price_in_e_u_r" TO "version_price_in_u_s_d";
   ALTER TABLE "zapletane"."_products_v" RENAME COLUMN "version_price_in_e_u_r_enabled" TO "version_price_in_u_s_d_enabled";
   ALTER TABLE "zapletane"."variants" RENAME COLUMN "price_in_e_u_r" TO "price_in_u_s_d";
   ALTER TABLE "zapletane"."variants" RENAME COLUMN "price_in_e_u_r_enabled" TO "price_in_u_s_d_enabled";
   ALTER TABLE "zapletane"."_variants_v" RENAME COLUMN "version_price_in_e_u_r" TO "version_price_in_u_s_d";
   ALTER TABLE "zapletane"."_variants_v" RENAME COLUMN "version_price_in_e_u_r_enabled" TO "version_price_in_u_s_d_enabled";
   ALTER TYPE "zapletane"."enum_carts_currency" RENAME VALUE 'EUR' TO 'USD';
   ALTER TYPE "zapletane"."enum_orders_currency" RENAME VALUE 'EUR' TO 'USD';
   ALTER TYPE "zapletane"."enum_transactions_currency" RENAME VALUE 'EUR' TO 'USD';
  `)
}
