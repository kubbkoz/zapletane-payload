import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`homepage_hero_slides\` ADD \`media_type\` text DEFAULT 'image';`)
  await db.run(sql`ALTER TABLE \`homepage_hero_slides\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`homepage_hero_slides\` ADD \`video_poster_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_video_idx\` ON \`homepage_hero_slides\` (\`video_id\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_video_poster_idx\` ON \`homepage_hero_slides\` (\`video_poster_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_homepage_hero_slides\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`image_url\` text,
  	\`eyebrow\` text,
  	\`title\` text,
  	\`text\` text,
  	\`cta_label\` text,
  	\`cta_href\` text,
  	\`secondary_cta_label\` text,
  	\`secondary_cta_href\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_homepage_hero_slides\`("_order", "_parent_id", "id", "image_id", "image_url", "eyebrow", "title", "text", "cta_label", "cta_href", "secondary_cta_label", "secondary_cta_href") SELECT "_order", "_parent_id", "id", "image_id", "image_url", "eyebrow", "title", "text", "cta_label", "cta_href", "secondary_cta_label", "secondary_cta_href" FROM \`homepage_hero_slides\`;`)
  await db.run(sql`DROP TABLE \`homepage_hero_slides\`;`)
  await db.run(sql`ALTER TABLE \`__new_homepage_hero_slides\` RENAME TO \`homepage_hero_slides\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_order_idx\` ON \`homepage_hero_slides\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_parent_id_idx\` ON \`homepage_hero_slides\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_image_idx\` ON \`homepage_hero_slides\` (\`image_id\`);`)
}
