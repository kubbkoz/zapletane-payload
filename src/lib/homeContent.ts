import type { Homepage } from '@/payload-types'

import {
  CATEGORY_SECTION,
  type CategorySectionContent,
  FEATURES,
  type FeaturesContent,
  GIFT_CTA,
  type GiftCtaContent,
  HERO_PERKS,
  type HeroPerk,
  HERO_SLIDES,
  type HeroSlide,
  type Hotspot,
  PRODUCT_TAB_SORTS,
  PRODUCT_TABS,
  type ProductTabDefinition,
  type ProductTabSort,
  type ProductTabsContent,
  SLOGAN,
  type SloganContent,
  type ValueCard,
} from '@/lib/homeDefaults'

/**
 * `homepage` global → the shapes the homepage components already consume.
 *
 * Every resolver degrades gracefully in two directions:
 *
 *   - `homepage` is null (database unreachable) → the baked defaults.
 *   - a single field is null/empty (a row saved before the field existed) →
 *     that field's baked default, the rest still from the CMS.
 *
 * That is what makes "deploy changes nothing on screen" true for a database
 * that has never seen this global *and* for one that has.
 */

const pick = (value: null | string | undefined, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value : fallback

const optional = (value: null | string | undefined): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

/**
 * An uploaded media item wins; otherwise the static path the slide carries;
 * otherwise the shipped WebP the section used to hard-code.
 */
function imageSrc(image: unknown, imageUrl: null | string | undefined, fallback: string): string {
  if (image && typeof image === 'object' && 'url' in image) {
    const url = (image as { url?: null | string }).url

    if (typeof url === 'string' && url.trim() !== '') return url
  }

  return pick(imageUrl, fallback)
}

function resolveHotspots(
  rows: NonNullable<NonNullable<Homepage['hero']>['slides']>[number]['hotspots'],
  slideIndex: number,
): Hotspot[] {
  if (!rows?.length) return []

  return rows
    .filter((row) => row?.label)
    .map((row, index) => {
      const product = row.product

      const productHref =
        product && typeof product === 'object' && product.slug
          ? `/products/${product.slug}`
          : undefined

      return {
        id: row.id || `slide-${slideIndex}-hotspot-${index}`,
        x: typeof row.x === 'number' ? row.x : 50,
        y: typeof row.y === 'number' ? row.y : 50,
        label: row.label as string,
        price: pick(row.price, ''),
        link: productHref || optional(row.href),
      }
    })
}

export function resolveHeroSlides(homepage?: Homepage | null): HeroSlide[] {
  const rows = homepage?.hero?.slides

  if (!rows?.length) return HERO_SLIDES

  const slides = rows
    .filter((row) => row?.title)
    .map((row, index) => {
      const fallback = HERO_SLIDES[index] || HERO_SLIDES[0]

      return {
        id: row.id || `slide-${index + 1}`,
        badge: optional(row.eyebrow),
        title: row.title as string,
        subtitle: pick(row.text, ''),
        image: imageSrc(row.image, row.imageUrl, fallback?.image ?? ''),
        cta: pick(row.ctaLabel, fallback?.cta ?? 'Objaviť ponuku'),
        ctaLink: optional(row.ctaHref) || fallback?.ctaLink,
        secondaryCta: optional(row.secondaryCtaLabel),
        secondaryCtaLink: optional(row.secondaryCtaHref),
        hotspots: resolveHotspots(row.hotspots, index),
      }
    })
    // A slide with no usable image would render an empty frame.
    .filter((slide) => slide.image !== '')

  return slides.length ? slides : HERO_SLIDES
}

export function resolveHeroPerks(homepage?: Homepage | null): HeroPerk[] {
  const rows = homepage?.hero?.perks

  if (!rows?.length) return HERO_PERKS

  const perks = rows
    .filter((row) => row?.label)
    .map((row, index) => ({
      icon: (row.icon || HERO_PERKS[index]?.icon || 'Star') as HeroPerk['icon'],
      label: row.label as string,
    }))

  return perks.length ? perks : HERO_PERKS
}

export function resolveSlogan(homepage?: Homepage | null): SloganContent {
  return {
    before: pick(homepage?.slogan?.before, SLOGAN.before),
    highlight: pick(homepage?.slogan?.highlight, SLOGAN.highlight),
    after: pick(homepage?.slogan?.after, SLOGAN.after),
  }
}

export function resolveFeatures(homepage?: Homepage | null): FeaturesContent {
  const rows = homepage?.features?.cards

  const cards: ValueCard[] = rows?.length
    ? rows
        .filter((row) => row?.title)
        .map((row, index) => ({
          icon: (row.icon || FEATURES.cards[index]?.icon || 'Star') as ValueCard['icon'],
          title: row.title as string,
          desc: pick(row.text, ''),
        }))
    : FEATURES.cards

  return {
    eyebrow: pick(homepage?.features?.eyebrow, FEATURES.eyebrow),
    heading: pick(homepage?.features?.heading, FEATURES.heading),
    text: pick(homepage?.features?.text, FEATURES.text),
    cards: cards.length ? cards : FEATURES.cards,
  }
}

const isKnownSort = (value: unknown): value is ProductTabSort =>
  typeof value === 'string' && (PRODUCT_TAB_SORTS as readonly string[]).includes(value)

export function resolveProductTabs(homepage?: Homepage | null): ProductTabsContent {
  const rows = homepage?.productTabs?.tabs

  const tabs: ProductTabDefinition[] = rows?.length
    ? rows
        .filter((row) => row?.label && row?.enabled !== false)
        .map((row, index) => ({
          key: row.id || `tab-${index}`,
          label: row.label as string,
          // Never trust a stored sort blindly — an unknown value would become an
          // arbitrary Payload sort expression.
          sort: isKnownSort(row.sort) ? row.sort : '-createdAt',
        }))
    : PRODUCT_TABS.tabs

  return {
    eyebrow: pick(homepage?.productTabs?.eyebrow, PRODUCT_TABS.eyebrow),
    titleBefore: pick(homepage?.productTabs?.titleBefore, PRODUCT_TABS.titleBefore),
    titleHighlight: pick(homepage?.productTabs?.titleHighlight, PRODUCT_TABS.titleHighlight),
    tabs: tabs.length ? tabs : PRODUCT_TABS.tabs,
  }
}

export function resolveCategorySection(homepage?: Homepage | null): CategorySectionContent {
  return {
    eyebrow: pick(homepage?.categories?.eyebrow, CATEGORY_SECTION.eyebrow),
    titleLine: pick(homepage?.categories?.titleLine, CATEGORY_SECTION.titleLine),
    titleHighlight: pick(homepage?.categories?.titleHighlight, CATEGORY_SECTION.titleHighlight),
    text: pick(homepage?.categories?.text, CATEGORY_SECTION.text),
    ctaLabel: pick(homepage?.categories?.ctaLabel, CATEGORY_SECTION.ctaLabel),
    ctaHref: pick(homepage?.categories?.ctaHref, CATEGORY_SECTION.ctaHref),
  }
}

export function resolveGiftCta(homepage?: Homepage | null): GiftCtaContent {
  return {
    title: pick(homepage?.giftCta?.title, GIFT_CTA.title),
    text: pick(homepage?.giftCta?.text, GIFT_CTA.text),
    ctaLabel: pick(homepage?.giftCta?.ctaLabel, GIFT_CTA.ctaLabel),
    ctaHref: pick(homepage?.giftCta?.ctaHref, GIFT_CTA.ctaHref),
    image: imageSrc(homepage?.giftCta?.image, homepage?.giftCta?.imageUrl, GIFT_CTA.image),
  }
}
