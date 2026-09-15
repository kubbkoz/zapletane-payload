/**
 * Spoločné typy scrapera (Z12).
 *
 * Engine je zámerne oddelený od Payloadu: `ScrapedProduct` je čistý dátový
 * tvar, ktorý vie vzniknúť z ľubovoľného e-shopu, a až `importProduct` ho
 * prekladá do dokumentov tejto inštalácie. Vďaka tomu sa dá extrakcia
 * testovať nad uloženým HTML bez databázy.
 */

/** Jedna dvojica „názov: hodnota" z tabuľky parametrov na stránke produktu. */
export type ScrapedAttribute = {
  name: string
  value: string
}

/** Výstup `extractProduct` — všetko, čo sa o produkte dá vyčítať zo stránky. */
export type ScrapedProduct = {
  attributes: ScrapedAttribute[]
  /** `InStock` / `OutOfStock` / `PreOrder`… tak, ako to povedal zdroj. */
  availability?: null | string
  /** Cesta v omrvinkovej navigácii bez „domov" a bez samotného produktu. */
  categoryPath: string[]
  descriptionHtml: string
  descriptionText: string
  /** Identifikátor z URL (pri Shoperi číslo na konci `/pl/p/<názov>/<id>`). */
  externalId: string
  images: string[]
  priceAmount: null | number
  priceCurrency: null | string
  sku: null | string
  sourceUrl: string
  title: string
}

/** Preložená (alebo pri `sk` len prekopírovaná) podoba jedného produktu. */
export type TranslatedProduct = {
  attributes: ScrapedAttribute[]
  categoryPath: string[]
  /** Odseky popisu ako čistý text — z nich vzniká lexical richtext. */
  descriptionParagraphs: string[]
  title: string
}

/** Produkt pripravený na import: sken + preklad + prepočítaná cena. */
export type PreparedProduct = {
  /** Cena v eurocentoch po zaokrúhlení na X,99. */
  priceInEUR: null | number
  scraped: ScrapedProduct
  translated: TranslatedProduct
}

/**
 * Náhľadová karta pre admin UI. Ukladá sa do `scraper-jobs.previews` (json),
 * takže tvar musí byť serializovateľný a stabilný — komponent ho číta priamo.
 */
export type ProductPreview = {
  attributes: ScrapedAttribute[]
  categoryPath: string[]
  descriptionExcerpt: string
  image: null | string
  originalPrice: null | string
  originalTitle: string
  priceInEUR: null | number
  sku: null | string
  sourceUrl: string
  title: string
}

/**
 * Jedna položka výberu kategórií (Z14) — presný tvar poľa
 * `scraper-jobs.categoryMap` (json).
 *
 * Výber sa drží PRIAMO v položke (`selected`), nie v samostatnom zozname
 * adries: zoznam kategórií a zoznam zaškrtnutých by boli dve pravdy o tom
 * istom, ktoré sa dajú rozísť (kategória zmizne zo zdroja, adresa ostane vo
 * výbere). Takto je vždy jasné, čo je zaškrtnuté a ako sa to volá.
 *
 * Prázdny výber (nič zaškrtnuté) znamená „celý obchod" — je to prirodzený
 * východiskový stav a v admine je to napísané nad zoznamom.
 */
export type CategoryMapEntry = {
  name: string
  /** Koľko produktov kategória podľa navigácie má; `null`, keď to nehovorí. */
  productCountEstimate: null | number
  selected: boolean
  /** Slovenský názov z jedného prekladového volania; pri zlyhaní `= name`. */
  translatedName: string
  url: string
}

/** Nastavenia jednej úlohy, ktoré engine potrebuje. */
export type ScraperJobSettings = {
  batchSize?: null | number
  detectedLanguage?: null | string
  fallbackRate?: null | number
  maxProducts?: null | number
  sourceUrl: string
}
