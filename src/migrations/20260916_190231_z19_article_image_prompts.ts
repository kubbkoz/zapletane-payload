import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Z19 — prompty na obrázky ku generovanému článku (sqlite dvojička).
 *
 * Podstata je tá istá ako v `src/migrations-pg`: `posts.ai_image_prompts`
 * a `_posts_v.version_ai_image_prompts`, oboje voliteľné a aditívne.
 *
 * Navyše je tu prestavba `scraper_jobs` — sqlite nevie zmeniť DEFAULT stĺpca,
 * takže drizzle tabuľku vyrobí nanovo a dáta prekopíruje. Ide o ten istý
 * prívesok ako v postgresovej verzii: `batch_size` má od Z16 default 3 a do
 * snapshotu sa to nikdy nezapísalo. Lokálne beží sqlite v režime `push`
 * (schéma sa dorovnáva sama), takže táto migrácia sa tu prakticky nespúšťa —
 * v strome je preto, aby dvojica migrácií ostala úplná.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_scraper_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source_url\` text NOT NULL,
  	\`status\` text DEFAULT 'new',
  	\`detected_language\` text,
  	\`fallback_rate\` numeric DEFAULT 4.3,
  	\`batch_size\` numeric DEFAULT 3,
  	\`max_products\` numeric DEFAULT 500,
  	\`counters_discovered\` numeric DEFAULT 0,
  	\`counters_imported\` numeric DEFAULT 0,
  	\`counters_skipped\` numeric DEFAULT 0,
  	\`counters_failed\` numeric DEFAULT 0,
  	\`counters_skipped_existing\` numeric DEFAULT 0,
  	\`previews\` text,
  	\`log\` text,
  	\`product_links\` text,
  	\`cursor\` numeric DEFAULT 0,
  	\`category_map\` text,
  	\`heartbeat_at\` text,
  	\`chain_count\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_scraper_jobs\`("id", "source_url", "status", "detected_language", "fallback_rate", "batch_size", "max_products", "counters_discovered", "counters_imported", "counters_skipped", "counters_failed", "counters_skipped_existing", "previews", "log", "product_links", "cursor", "category_map", "heartbeat_at", "chain_count", "updated_at", "created_at") SELECT "id", "source_url", "status", "detected_language", "fallback_rate", "batch_size", "max_products", "counters_discovered", "counters_imported", "counters_skipped", "counters_failed", "counters_skipped_existing", "previews", "log", "product_links", "cursor", "category_map", "heartbeat_at", "chain_count", "updated_at", "created_at" FROM \`scraper_jobs\`;`)
  await db.run(sql`DROP TABLE \`scraper_jobs\`;`)
  await db.run(sql`ALTER TABLE \`__new_scraper_jobs\` RENAME TO \`scraper_jobs\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_status_idx\` ON \`scraper_jobs\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_updated_at_idx\` ON \`scraper_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_created_at_idx\` ON \`scraper_jobs\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`ai_image_prompts\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` ADD \`version_ai_image_prompts\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_scraper_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source_url\` text NOT NULL,
  	\`status\` text DEFAULT 'new',
  	\`detected_language\` text,
  	\`fallback_rate\` numeric DEFAULT 4.3,
  	\`batch_size\` numeric DEFAULT 5,
  	\`max_products\` numeric DEFAULT 500,
  	\`counters_discovered\` numeric DEFAULT 0,
  	\`counters_imported\` numeric DEFAULT 0,
  	\`counters_skipped\` numeric DEFAULT 0,
  	\`counters_failed\` numeric DEFAULT 0,
  	\`counters_skipped_existing\` numeric DEFAULT 0,
  	\`previews\` text,
  	\`log\` text,
  	\`product_links\` text,
  	\`cursor\` numeric DEFAULT 0,
  	\`category_map\` text,
  	\`heartbeat_at\` text,
  	\`chain_count\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_scraper_jobs\`("id", "source_url", "status", "detected_language", "fallback_rate", "batch_size", "max_products", "counters_discovered", "counters_imported", "counters_skipped", "counters_failed", "counters_skipped_existing", "previews", "log", "product_links", "cursor", "category_map", "heartbeat_at", "chain_count", "updated_at", "created_at") SELECT "id", "source_url", "status", "detected_language", "fallback_rate", "batch_size", "max_products", "counters_discovered", "counters_imported", "counters_skipped", "counters_failed", "counters_skipped_existing", "previews", "log", "product_links", "cursor", "category_map", "heartbeat_at", "chain_count", "updated_at", "created_at" FROM \`scraper_jobs\`;`)
  await db.run(sql`DROP TABLE \`scraper_jobs\`;`)
  await db.run(sql`ALTER TABLE \`__new_scraper_jobs\` RENAME TO \`scraper_jobs\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_status_idx\` ON \`scraper_jobs\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_updated_at_idx\` ON \`scraper_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`scraper_jobs_created_at_idx\` ON \`scraper_jobs\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`posts\` DROP COLUMN \`ai_image_prompts\`;`)
  await db.run(sql`ALTER TABLE \`_posts_v\` DROP COLUMN \`version_ai_image_prompts\`;`)
}
