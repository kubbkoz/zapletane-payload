import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "zapletane"."enum_header_nav_items_children_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "zapletane"."enum_header_top_bar_links_icon" AS ENUM('none', 'BookOpen', 'Phone', 'Mail');
  CREATE TYPE "zapletane"."enum_footer_social_links_platform" AS ENUM('facebook', 'instagram', 'linkedin', 'twitter', 'youtube');
  CREATE TYPE "zapletane"."enum_homepage_hero_perks_icon" AS ENUM('Heart', 'Leaf', 'Sparkles', 'Truck', 'Hand', 'Package', 'Star', 'Shield');
  CREATE TYPE "zapletane"."enum_homepage_features_cards_icon" AS ENUM('Heart', 'Leaf', 'Sparkles', 'Truck', 'Hand', 'Package', 'Star', 'Shield');
  CREATE TYPE "zapletane"."enum_homepage_product_tabs_tabs_sort" AS ENUM('-createdAt', 'title', 'priceInEUR', '-priceInEUR');
  CREATE TABLE "zapletane"."header_nav_items_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "zapletane"."enum_header_nav_items_children_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL
  );
  
  CREATE TABLE "zapletane"."header_top_bar_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"icon" "zapletane"."enum_header_top_bar_links_icon" DEFAULT 'none',
  	"highlight" boolean
  );
  
  CREATE TABLE "zapletane"."footer_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "zapletane"."enum_footer_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "zapletane"."homepage_hero_slides_hotspots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"x" numeric,
  	"y" numeric,
  	"label" varchar,
  	"price" varchar,
  	"product_id" integer,
  	"href" varchar
  );
  
  CREATE TABLE "zapletane"."homepage_hero_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_url" varchar,
  	"eyebrow" varchar,
  	"title" varchar,
  	"text" varchar,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar
  );
  
  CREATE TABLE "zapletane"."homepage_hero_perks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "zapletane"."enum_homepage_hero_perks_icon",
  	"label" varchar
  );
  
  CREATE TABLE "zapletane"."homepage_features_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "zapletane"."enum_homepage_features_cards_icon",
  	"title" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "zapletane"."homepage_product_tabs_tabs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"sort" "zapletane"."enum_homepage_product_tabs_tabs_sort" DEFAULT '-createdAt',
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "zapletane"."homepage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slogan_before" varchar DEFAULT 'Vyrábame veci, ktoré',
  	"slogan_highlight" varchar DEFAULT 'zostávajú',
  	"slogan_after" varchar DEFAULT '— nie tie, ktoré sa vyhadzujú.',
  	"features_eyebrow" varchar DEFAULT 'Prečo Zapletane',
  	"features_heading" varchar DEFAULT 'Ručná práca,
  ktorá vydrží generácie',
  	"features_text" varchar DEFAULT 'Každý kúsok vzniká pomaly a v malých sériách. Nie preto, že by sme nevedeli rýchlejšie — ale preto, že rýchlo sa to spraviť nedá.',
  	"product_tabs_eyebrow" varchar DEFAULT 'Z dielne',
  	"product_tabs_title_before" varchar DEFAULT 'Naše',
  	"product_tabs_title_highlight" varchar DEFAULT 'produkty',
  	"categories_eyebrow" varchar DEFAULT 'Sortiment',
  	"categories_title_line" varchar DEFAULT 'Vyberte si',
  	"categories_title_highlight" varchar DEFAULT 'Kategóriu',
  	"categories_text" varchar DEFAULT 'Objavte našu ponuku ručne pletených diek, hračiek a prútených dekorácií',
  	"categories_cta_label" varchar DEFAULT 'Prezrieť ponuku',
  	"categories_cta_href" varchar DEFAULT '/shop',
  	"gift_cta_title" varchar DEFAULT 'Hľadáte darček, ktorý poteší?',
  	"gift_cta_text" varchar DEFAULT 'Ručne vyrobené kúsky s dušou — pre blízkych, ktorí si zaslúžia niečo výnimočné.',
  	"gift_cta_cta_label" varchar DEFAULT 'Nájsť darček',
  	"gift_cta_cta_href" varchar DEFAULT '/shop',
  	"gift_cta_image_id" integer,
  	"gift_cta_image_url" varchar DEFAULT '/assets/images/hero/hero-zahrada.webp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "homepage_find" boolean DEFAULT false;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" ADD COLUMN "homepage_update" boolean DEFAULT false;
  ALTER TABLE "zapletane"."footer" ADD COLUMN "description" varchar DEFAULT 'U nás nájdete ručne pletené deky a hračky, prútené dekorácie aj doplnky do domácnosti. Každý kúsok vzniká s láskou a trpezlivosťou.';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "nav_title" varchar DEFAULT 'Kategórie';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_heading" varchar DEFAULT 'Kontakt';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_phone_label" varchar DEFAULT 'Infolinka';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_email_label" varchar DEFAULT 'Email';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_returns_label" varchar DEFAULT 'Reklamácia / Vrátenie';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_returns_link_label" varchar DEFAULT 'Vyplniť formulár';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_returns_href" varchar DEFAULT '/odstupenie-od-zmluvy';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "contact_show_business_details" boolean DEFAULT false;
  ALTER TABLE "zapletane"."footer" ADD COLUMN "support_heading" varchar DEFAULT 'Zákaznícka podpora';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "support_text" varchar DEFAULT 'Sme tu pre vás každý pracovný deň a radi poradíme s výberom toho pravého.';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "bottom_bar_copyright" varchar DEFAULT '© {{year}} Zapletane. Všetky práva vyhradené.';
  ALTER TABLE "zapletane"."footer" ADD COLUMN "bottom_bar_cookie_button_label" varchar DEFAULT 'Nastavenia cookies';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_phone" varchar DEFAULT '+421 915 675 870';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_email" varchar DEFAULT 'info@zapletane.sk';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_company_name" varchar DEFAULT 'Zapletane';
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_ico" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_dic" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_ic_dph" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_address" varchar;
  ALTER TABLE "zapletane"."site_settings" ADD COLUMN "contact_opening_hours" varchar;
  ALTER TABLE "zapletane"."header_nav_items_children" ADD CONSTRAINT "header_nav_items_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."header_nav_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."header_top_bar_links" ADD CONSTRAINT "header_top_bar_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."footer_social_links" ADD CONSTRAINT "footer_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_slides_hotspots" ADD CONSTRAINT "homepage_hero_slides_hotspots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "zapletane"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_slides_hotspots" ADD CONSTRAINT "homepage_hero_slides_hotspots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."homepage_hero_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD CONSTRAINT "homepage_hero_slides_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_slides" ADD CONSTRAINT "homepage_hero_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_hero_perks" ADD CONSTRAINT "homepage_hero_perks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_features_cards" ADD CONSTRAINT "homepage_features_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage_product_tabs_tabs" ADD CONSTRAINT "homepage_product_tabs_tabs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "zapletane"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "zapletane"."homepage" ADD CONSTRAINT "homepage_gift_cta_image_id_media_id_fk" FOREIGN KEY ("gift_cta_image_id") REFERENCES "zapletane"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "header_nav_items_children_order_idx" ON "zapletane"."header_nav_items_children" USING btree ("_order");
  CREATE INDEX "header_nav_items_children_parent_id_idx" ON "zapletane"."header_nav_items_children" USING btree ("_parent_id");
  CREATE INDEX "header_top_bar_links_order_idx" ON "zapletane"."header_top_bar_links" USING btree ("_order");
  CREATE INDEX "header_top_bar_links_parent_id_idx" ON "zapletane"."header_top_bar_links" USING btree ("_parent_id");
  CREATE INDEX "footer_social_links_order_idx" ON "zapletane"."footer_social_links" USING btree ("_order");
  CREATE INDEX "footer_social_links_parent_id_idx" ON "zapletane"."footer_social_links" USING btree ("_parent_id");
  CREATE INDEX "homepage_hero_slides_hotspots_order_idx" ON "zapletane"."homepage_hero_slides_hotspots" USING btree ("_order");
  CREATE INDEX "homepage_hero_slides_hotspots_parent_id_idx" ON "zapletane"."homepage_hero_slides_hotspots" USING btree ("_parent_id");
  CREATE INDEX "homepage_hero_slides_hotspots_product_idx" ON "zapletane"."homepage_hero_slides_hotspots" USING btree ("product_id");
  CREATE INDEX "homepage_hero_slides_order_idx" ON "zapletane"."homepage_hero_slides" USING btree ("_order");
  CREATE INDEX "homepage_hero_slides_parent_id_idx" ON "zapletane"."homepage_hero_slides" USING btree ("_parent_id");
  CREATE INDEX "homepage_hero_slides_image_idx" ON "zapletane"."homepage_hero_slides" USING btree ("image_id");
  CREATE INDEX "homepage_hero_perks_order_idx" ON "zapletane"."homepage_hero_perks" USING btree ("_order");
  CREATE INDEX "homepage_hero_perks_parent_id_idx" ON "zapletane"."homepage_hero_perks" USING btree ("_parent_id");
  CREATE INDEX "homepage_features_cards_order_idx" ON "zapletane"."homepage_features_cards" USING btree ("_order");
  CREATE INDEX "homepage_features_cards_parent_id_idx" ON "zapletane"."homepage_features_cards" USING btree ("_parent_id");
  CREATE INDEX "homepage_product_tabs_tabs_order_idx" ON "zapletane"."homepage_product_tabs_tabs" USING btree ("_order");
  CREATE INDEX "homepage_product_tabs_tabs_parent_id_idx" ON "zapletane"."homepage_product_tabs_tabs" USING btree ("_parent_id");
  CREATE INDEX "homepage_gift_cta_gift_cta_image_idx" ON "zapletane"."homepage" USING btree ("gift_cta_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "zapletane"."header_nav_items_children" CASCADE;
  DROP TABLE "zapletane"."header_top_bar_links" CASCADE;
  DROP TABLE "zapletane"."footer_social_links" CASCADE;
  DROP TABLE "zapletane"."homepage_hero_slides_hotspots" CASCADE;
  DROP TABLE "zapletane"."homepage_hero_slides" CASCADE;
  DROP TABLE "zapletane"."homepage_hero_perks" CASCADE;
  DROP TABLE "zapletane"."homepage_features_cards" CASCADE;
  DROP TABLE "zapletane"."homepage_product_tabs_tabs" CASCADE;
  DROP TABLE "zapletane"."homepage" CASCADE;
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "homepage_find";
  ALTER TABLE "zapletane"."payload_mcp_api_keys" DROP COLUMN "homepage_update";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "description";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "nav_title";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_heading";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_phone_label";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_email_label";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_returns_label";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_returns_link_label";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_returns_href";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "contact_show_business_details";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "support_heading";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "support_text";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "bottom_bar_copyright";
  ALTER TABLE "zapletane"."footer" DROP COLUMN "bottom_bar_cookie_button_label";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_phone";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_email";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_company_name";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_ico";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_dic";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_ic_dph";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_address";
  ALTER TABLE "zapletane"."site_settings" DROP COLUMN "contact_opening_hours";
  DROP TYPE "zapletane"."enum_header_nav_items_children_link_type";
  DROP TYPE "zapletane"."enum_header_top_bar_links_icon";
  DROP TYPE "zapletane"."enum_footer_social_links_platform";
  DROP TYPE "zapletane"."enum_homepage_hero_perks_icon";
  DROP TYPE "zapletane"."enum_homepage_features_cards_icon";
  DROP TYPE "zapletane"."enum_homepage_product_tabs_tabs_sort";`)
}
