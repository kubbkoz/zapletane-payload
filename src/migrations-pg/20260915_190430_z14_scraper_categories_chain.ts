import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Z14 — výber kategórií a serverové reťazenie dávok v importe z webu.
 *
 * Generované offline podľa docs/AGENT-ROADMAP.md („Operatívne pravidlá" §1) a
 * čisto aditívne: štyri nové stĺpce na `scraper_jobs` a dve nové hodnoty
 * stavového enumu. Nič sa nepremenúva ani nezahadzuje, takže sa do toho
 * nezamiešal žiadny interaktívny drizzle prompt.
 *
 *   - `category_map`   — zoznam kategórií zdroja aj s výberom majiteľky
 *                        (tvar `CategoryMapEntry` zo `src/scraper/types.ts`).
 *   - `heartbeat_at`   — kedy dobehla posledná dávka; podľa toho sa pozná
 *                        padnutá reťaz (stav „importing" + starý tep).
 *   - `chain_count`    — tvrdý strop na počet dávok, ktoré si úloha zreťazí sama.
 *   - `counters_skipped_existing` — koľko produktov sa nepridalo preto, že taký
 *                        v obchode už je.
 *
 * `ALTER TYPE ... ADD VALUE` v transakcii vyžaduje PostgreSQL 12+ (Neon je
 * ďaleko za tým) a nové hodnoty sa v tej istej transakcii nepoužívajú — to je
 * druhá polovica tej podmienky. Rovnaký vzor ako v `20260914_222406_shipping_payments`.
 *
 * **Prívesok, ktorý do Z14 nepatrí.** `posts.ai_prompt` a
 * `_posts_v.version_ai_prompt` pochádzajú z rozpracovanej práce iného agenta,
 * ktorú `migrate:create` našiel v konfigurácii. Sú tu zámerne: snapshot ich už
 * obsahuje, takže keby sa tu DDL vynechalo, stĺpce by v produkcii nevznikli
 * nikdy a Payload by na nich spadol pri prvom uložení článku.
 *
 * Existujúce dokumenty úloh (napr. produkčná úloha id 2 v stave „new") sa
 * načítajú bez zmeny: všetky nové stĺpce sú voliteľné a staré hodnoty stavu
 * v enume ostávajú.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "zapletane"."enum_scraper_jobs_status" ADD VALUE 'categories_ready' BEFORE 'preview_running';
  ALTER TYPE "zapletane"."enum_scraper_jobs_status" ADD VALUE 'stopped' BEFORE 'done';
  ALTER TABLE "zapletane"."posts" ADD COLUMN "ai_prompt" varchar;
  ALTER TABLE "zapletane"."_posts_v" ADD COLUMN "version_ai_prompt" varchar;
  ALTER TABLE "zapletane"."scraper_jobs" ADD COLUMN "counters_skipped_existing" numeric DEFAULT 0;
  ALTER TABLE "zapletane"."scraper_jobs" ADD COLUMN "category_map" jsonb;
  ALTER TABLE "zapletane"."scraper_jobs" ADD COLUMN "heartbeat_at" timestamp(3) with time zone;
  ALTER TABLE "zapletane"."scraper_jobs" ADD COLUMN "chain_count" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "status" SET DEFAULT 'new'::text;
  DROP TYPE "zapletane"."enum_scraper_jobs_status";
  CREATE TYPE "zapletane"."enum_scraper_jobs_status" AS ENUM('new', 'preview_running', 'awaiting_confirm', 'importing', 'done', 'failed');
  ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "status" SET DEFAULT 'new'::"zapletane"."enum_scraper_jobs_status";
  ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "status" SET DATA TYPE "zapletane"."enum_scraper_jobs_status" USING "status"::"zapletane"."enum_scraper_jobs_status";
  ALTER TABLE "zapletane"."posts" DROP COLUMN "ai_prompt";
  ALTER TABLE "zapletane"."_posts_v" DROP COLUMN "version_ai_prompt";
  ALTER TABLE "zapletane"."scraper_jobs" DROP COLUMN "counters_skipped_existing";
  ALTER TABLE "zapletane"."scraper_jobs" DROP COLUMN "category_map";
  ALTER TABLE "zapletane"."scraper_jobs" DROP COLUMN "heartbeat_at";
  ALTER TABLE "zapletane"."scraper_jobs" DROP COLUMN "chain_count";`)
}
