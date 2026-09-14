import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`header_nav_items_children\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'reference',
  	\`link_new_tab\` integer,
  	\`link_url\` text,
  	\`link_label\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_nav_items_children_order_idx\` ON \`header_nav_items_children\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_children_parent_id_idx\` ON \`header_nav_items_children\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_top_bar_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`href\` text NOT NULL,
  	\`icon\` text DEFAULT 'none',
  	\`highlight\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_top_bar_links_order_idx\` ON \`header_top_bar_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_top_bar_links_parent_id_idx\` ON \`header_top_bar_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_social_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`platform\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_social_links_order_idx\` ON \`footer_social_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_social_links_parent_id_idx\` ON \`footer_social_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage_hero_slides_hotspots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`x\` numeric,
  	\`y\` numeric,
  	\`label\` text,
  	\`price\` text,
  	\`product_id\` integer,
  	\`href\` text,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage_hero_slides\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_hotspots_order_idx\` ON \`homepage_hero_slides_hotspots\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_hotspots_parent_id_idx\` ON \`homepage_hero_slides_hotspots\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_hotspots_product_idx\` ON \`homepage_hero_slides_hotspots\` (\`product_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage_hero_slides\` (
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
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_order_idx\` ON \`homepage_hero_slides\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_parent_id_idx\` ON \`homepage_hero_slides\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_slides_image_idx\` ON \`homepage_hero_slides\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage_hero_perks\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`homepage_hero_perks_order_idx\` ON \`homepage_hero_perks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_hero_perks_parent_id_idx\` ON \`homepage_hero_perks\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage_features_cards\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`homepage_features_cards_order_idx\` ON \`homepage_features_cards\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_features_cards_parent_id_idx\` ON \`homepage_features_cards\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage_product_tabs_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`sort\` text DEFAULT '-createdAt',
  	\`enabled\` integer DEFAULT true,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`homepage_product_tabs_tabs_order_idx\` ON \`homepage_product_tabs_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`homepage_product_tabs_tabs_parent_id_idx\` ON \`homepage_product_tabs_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`homepage\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slogan_before\` text DEFAULT 'Vyrábame veci, ktoré',
  	\`slogan_highlight\` text DEFAULT 'zostávajú',
  	\`slogan_after\` text DEFAULT '— nie tie, ktoré sa vyhadzujú.',
  	\`features_eyebrow\` text DEFAULT 'Prečo Zapletane',
  	\`features_heading\` text DEFAULT 'Ručná práca,
  ktorá vydrží generácie',
  	\`features_text\` text DEFAULT 'Každý kúsok vzniká pomaly a v malých sériách. Nie preto, že by sme nevedeli rýchlejšie — ale preto, že rýchlo sa to spraviť nedá.',
  	\`product_tabs_eyebrow\` text DEFAULT 'Z dielne',
  	\`product_tabs_title_before\` text DEFAULT 'Naše',
  	\`product_tabs_title_highlight\` text DEFAULT 'produkty',
  	\`categories_eyebrow\` text DEFAULT 'Sortiment',
  	\`categories_title_line\` text DEFAULT 'Vyberte si',
  	\`categories_title_highlight\` text DEFAULT 'Kategóriu',
  	\`categories_text\` text DEFAULT 'Objavte našu ponuku ručne pletených diek, hračiek a prútených dekorácií',
  	\`categories_cta_label\` text DEFAULT 'Prezrieť ponuku',
  	\`categories_cta_href\` text DEFAULT '/shop',
  	\`gift_cta_title\` text DEFAULT 'Hľadáte darček, ktorý poteší?',
  	\`gift_cta_text\` text DEFAULT 'Ručne vyrobené kúsky s dušou — pre blízkych, ktorí si zaslúžia niečo výnimočné.',
  	\`gift_cta_cta_label\` text DEFAULT 'Nájsť darček',
  	\`gift_cta_cta_href\` text DEFAULT '/shop',
  	\`gift_cta_image_id\` integer,
  	\`gift_cta_image_url\` text DEFAULT '/assets/images/hero/hero-zahrada.webp',
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`gift_cta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`homepage_gift_cta_gift_cta_image_idx\` ON \`homepage\` (\`gift_cta_image_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`homepage_find\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`homepage_update\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`description\` text DEFAULT 'U nás nájdete ručne pletené deky a hračky, prútené dekorácie aj doplnky do domácnosti. Každý kúsok vzniká s láskou a trpezlivosťou.';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`nav_title\` text DEFAULT 'Kategórie';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_heading\` text DEFAULT 'Kontakt';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_phone_label\` text DEFAULT 'Infolinka';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_email_label\` text DEFAULT 'Email';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_returns_label\` text DEFAULT 'Reklamácia / Vrátenie';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_returns_link_label\` text DEFAULT 'Vyplniť formulár';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_returns_href\` text DEFAULT '/odstupenie-od-zmluvy';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`contact_show_business_details\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`support_heading\` text DEFAULT 'Zákaznícka podpora';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`support_text\` text DEFAULT 'Sme tu pre vás každý pracovný deň a radi poradíme s výberom toho pravého.';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`bottom_bar_copyright\` text DEFAULT '© {{year}} Zapletane. Všetky práva vyhradené.';`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`bottom_bar_cookie_button_label\` text DEFAULT 'Nastavenia cookies';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_phone\` text DEFAULT '+421 915 675 870';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_email\` text DEFAULT 'info@zapletane.sk';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_company_name\` text DEFAULT 'Zapletane';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_ico\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_dic\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_ic_dph\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_address\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`contact_opening_hours\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`header_nav_items_children\`;`)
  await db.run(sql`DROP TABLE \`header_top_bar_links\`;`)
  await db.run(sql`DROP TABLE \`footer_social_links\`;`)
  await db.run(sql`DROP TABLE \`homepage_hero_slides_hotspots\`;`)
  await db.run(sql`DROP TABLE \`homepage_hero_slides\`;`)
  await db.run(sql`DROP TABLE \`homepage_hero_perks\`;`)
  await db.run(sql`DROP TABLE \`homepage_features_cards\`;`)
  await db.run(sql`DROP TABLE \`homepage_product_tabs_tabs\`;`)
  await db.run(sql`DROP TABLE \`homepage\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`homepage_find\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`homepage_update\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`description\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`nav_title\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_heading\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_phone_label\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_email_label\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_returns_label\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_returns_link_label\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_returns_href\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`contact_show_business_details\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`support_heading\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`support_text\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`bottom_bar_copyright\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`bottom_bar_cookie_button_label\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_phone\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_email\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_company_name\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_ico\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_dic\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_ic_dph\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_address\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`contact_opening_hours\`;`)
}
