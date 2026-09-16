import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Z19 — prompty na obrázky ku generovanému článku.
 *
 * Generované offline zo snapshotu (`POSTGRES_URL` bola fiktívna) a čisto
 * aditívne: jeden nový stĺpec na `posts` a jeho dvojička na `_posts_v`.
 *
 *   - `posts.ai_image_prompts` / `_posts_v.version_ai_image_prompts`
 *     — text poľa „Návrhy obrázkov (AI)". Voliteľné, staré články sa načítajú
 *       bez zmeny s prázdnou hodnotou.
 *
 * **Prívesok, ktorý do Z19 nepatrí.** `scraper_jobs.batch_size` mení default
 * z 5 na 3. Pochádza z už zapísanej zmeny v `src/collections/ScraperJobs.ts`
 * (Z16), ku ktorej sa migrácia nevygenerovala, takže ju `migrate:create` našiel
 * ako rozdiel oproti snapshotu. Je tu zámerne a je neškodný: `SET DEFAULT` je
 * len metadáta stĺpca (žiadny prepis tabuľky, žiadne dáta), a Payload pri
 * vytváraní úlohy hodnotu aj tak posiela výslovne. Keby sa riadok vynechal,
 * snapshot by tvrdil 3, produkčná databáza by mala 5 a nikto by ten rozdiel
 * už nikdy nedohnal — rovnaká úvaha ako pri `ai_prompt` v migrácii Z14.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "batch_size" SET DEFAULT 3;
  ALTER TABLE "zapletane"."posts" ADD COLUMN "ai_image_prompts" varchar;
  ALTER TABLE "zapletane"."_posts_v" ADD COLUMN "version_ai_image_prompts" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "zapletane"."scraper_jobs" ALTER COLUMN "batch_size" SET DEFAULT 5;
  ALTER TABLE "zapletane"."posts" DROP COLUMN "ai_image_prompts";
  ALTER TABLE "zapletane"."_posts_v" DROP COLUMN "version_ai_image_prompts";`)
}
