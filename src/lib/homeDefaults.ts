import type { ContentIconName } from '@/lib/contentIcons'

/**
 * Homepage default content — the single source for BOTH halves of the
 * "editable, but nothing changes" contract (W2):
 *
 *   1. `src/globals/Homepage.ts` builds its field `defaultValue`s from these
 *      constants, so a database where the global has never been saved returns
 *      exactly this content from `findGlobal`.
 *   2. `src/lib/homeContent.ts` falls back to these constants field by field,
 *      so a *saved* global that predates a field (null column) still renders the
 *      original copy.
 *
 * Copy and imagery are carried over verbatim from the ZAPLETANE source
 * (`app/utils/constants.ts` HERO_SLIDES / FEATURES and the Vue section
 * templates), including the pre-compressed WebP shots that ship in /public.
 */

export type Hotspot = {
  id: string
  /** percentage offsets within the photo */
  x: number
  y: number
  label: string
  price: string
  image?: string
  link?: string
}

export type HeroSlide = {
  id: string
  badge?: string
  title: string
  subtitle: string
  image: string
  cta: string
  ctaLink?: string
  secondaryCta?: string
  secondaryCtaLink?: string
  hotspots: Hotspot[]
}

export type HeroPerk = {
  icon: ContentIconName
  label: string
}

export type ValueCard = {
  icon: ContentIconName
  title: string
  desc: string
}

export type SloganContent = {
  before: string
  highlight: string
  after: string
}

export type FeaturesContent = {
  eyebrow: string
  /** A line break in this string becomes a <br> in the rendered headline. */
  heading: string
  text: string
  cards: ValueCard[]
}

/**
 * The only `sort` expressions a tab may carry. Closed on purpose: the value
 * reaches `payload.find({ sort })` on the homepage, so an arbitrary stored
 * string must never get there.
 */
export const PRODUCT_TAB_SORTS = ['-createdAt', 'title', 'priceInEUR', '-priceInEUR'] as const

export type ProductTabSort = (typeof PRODUCT_TAB_SORTS)[number]

export type ProductTabDefinition = {
  key: string
  label: string
  /** Payload `sort` expression used to fill the tab. */
  sort: ProductTabSort
}

export type ProductTabsContent = {
  eyebrow: string
  titleBefore: string
  titleHighlight: string
  tabs: ProductTabDefinition[]
}

export type CategorySectionContent = {
  eyebrow: string
  titleLine: string
  titleHighlight: string
  text: string
  ctaLabel: string
  ctaHref: string
}

export type GiftCtaContent = {
  title: string
  text: string
  ctaLabel: string
  ctaHref: string
  image: string
}

/**
 * `hotspots` is part of the slide contract (the original hero can pin shoppable
 * markers onto the photo) but ships empty, exactly as it does upstream — so the
 * hero degrades to plain photography until a real catalogue exists to point the
 * markers at.
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-1',
    badge: 'Ručne pletené pre domov',
    title: 'Upletené s láskou, stvorené pre váš domov',
    subtitle:
      'Ručne pletené deky a hračky aj prútené dekorácie — poctivá ručná výroba, ktorá zahreje a poteší.',
    image: '/assets/images/hero/hero-kolekcia.webp',
    cta: 'Objaviť ponuku',
    ctaLink: '/shop',
    hotspots: [],
  },
  {
    id: 'slide-2',
    badge: 'Prútie a prírodné materiály',
    title: 'Prútené dekorácie a doplnky',
    subtitle:
      'Košíky, dekorácie a doplnky z prútia, ktoré dodajú vášmu interiéru prirodzené teplo a štýl.',
    image: '/assets/images/hero/hero-zahrada.webp',
    cta: 'Prezrieť dekorácie',
    ctaLink: '/shop',
    hotspots: [],
  },
]

/** Brand pillars under the hero CTA — the shop's promise, not the slide's content. */
export const HERO_PERKS: HeroPerk[] = [
  { icon: 'Hand', label: 'Ručná výroba' },
  { icon: 'Leaf', label: 'Prírodné materiály' },
  { icon: 'Truck', label: 'Doručenie do 3 dní' },
]

/** Brand pull-quote. `before` / `after` are joined with a single space. */
export const SLOGAN: SloganContent = {
  before: 'Vyrábame veci, ktoré',
  highlight: 'zostávajú',
  after: '— nie tie, ktoré sa vyhadzujú.',
}

/** Value cards (FEATURES in the Vue original) + their editorial header. */
export const FEATURES: FeaturesContent = {
  eyebrow: 'Prečo Zapletane',
  heading: 'Ručná práca,\nktorá vydrží generácie',
  text: 'Každý kúsok vzniká pomaly a v malých sériách. Nie preto, že by sme nevedeli rýchlejšie — ale preto, že rýchlo sa to spraviť nedá.',
  cards: [
    {
      title: 'Ručná výroba',
      desc: 'Každý kúsok je upletený alebo upletaný ručne — žiadna veľkovýroba, len poctivá práca a cit pre detail.',
      icon: 'Heart',
    },
    {
      title: 'Prírodné materiály',
      desc: 'Kvalitná vlna, bavlna a prútie z overených zdrojov, príjemné na dotyk a šetrné k prírode.',
      icon: 'Leaf',
    },
    {
      title: 'Originálne kúsky',
      desc: 'Dekorácie, deky aj hračky v malých sériách — u nás nájdete to, čo inde nekúpite.',
      icon: 'Sparkles',
    },
    {
      title: 'Rýchle doručenie',
      desc: 'Objednávku starostlivo zabalíme a odošleme čo najskôr, aby vám doma robila radosť už o pár dní.',
      icon: 'Truck',
    },
  ],
}

/** Tabbed product shelf. */
export const PRODUCT_TABS: ProductTabsContent = {
  eyebrow: 'Z dielne',
  titleBefore: 'Naše',
  titleHighlight: 'produkty',
  tabs: [
    { key: 'new', label: 'Nové', sort: '-createdAt' },
    { key: 'all', label: 'Celá ponuka', sort: 'title' },
    { key: 'value', label: 'Najvýhodnejšie', sort: 'priceInEUR' },
  ],
}

export const CATEGORY_SECTION: CategorySectionContent = {
  eyebrow: 'Sortiment',
  titleLine: 'Vyberte si',
  titleHighlight: 'Kategóriu',
  text: 'Objavte našu ponuku ručne pletených diek, hračiek a prútených dekorácií',
  ctaLabel: 'Prezrieť ponuku',
  ctaHref: '/shop',
}

export const GIFT_CTA: GiftCtaContent = {
  title: 'Hľadáte darček, ktorý poteší?',
  text: 'Ručne vyrobené kúsky s dušou — pre blízkych, ktorí si zaslúžia niečo výnimočné.',
  ctaLabel: 'Nájsť darček',
  ctaHref: '/shop',
  image: '/assets/images/hero/hero-zahrada.webp',
}

/**
 * The constants above, shaped like the `homepage` global's data.
 *
 * One mapping, three consumers: the global's field `defaultValue`s
 * (src/globals/Homepage.ts), the dev seed (scripts/seed-dev.ts) and the
 * production content-defaults migration. Keeping it here is what guarantees all
 * three agree to the character.
 */
export const homepageDefaultData = () => ({
  hero: {
    slides: HERO_SLIDES.map((slide) => ({
      eyebrow: slide.badge ?? null,
      title: slide.title,
      text: slide.subtitle,
      imageUrl: slide.image,
      ctaLabel: slide.cta,
      ctaHref: slide.ctaLink ?? null,
      secondaryCtaLabel: slide.secondaryCta ?? null,
      secondaryCtaHref: slide.secondaryCtaLink ?? null,
      hotspots: [],
    })),
    perks: HERO_PERKS.map((perk) => ({ icon: perk.icon, label: perk.label })),
  },
  slogan: { ...SLOGAN },
  features: {
    eyebrow: FEATURES.eyebrow,
    heading: FEATURES.heading,
    text: FEATURES.text,
    cards: FEATURES.cards.map((card) => ({
      icon: card.icon,
      title: card.title,
      text: card.desc,
    })),
  },
  productTabs: {
    eyebrow: PRODUCT_TABS.eyebrow,
    titleBefore: PRODUCT_TABS.titleBefore,
    titleHighlight: PRODUCT_TABS.titleHighlight,
    tabs: PRODUCT_TABS.tabs.map((tab) => ({
      enabled: true,
      label: tab.label,
      sort: tab.sort,
    })),
  },
  categories: {
    eyebrow: CATEGORY_SECTION.eyebrow,
    titleLine: CATEGORY_SECTION.titleLine,
    titleHighlight: CATEGORY_SECTION.titleHighlight,
    text: CATEGORY_SECTION.text,
    ctaLabel: CATEGORY_SECTION.ctaLabel,
    ctaHref: CATEGORY_SECTION.ctaHref,
  },
  giftCta: {
    title: GIFT_CTA.title,
    text: GIFT_CTA.text,
    ctaLabel: GIFT_CTA.ctaLabel,
    ctaHref: GIFT_CTA.ctaHref,
    imageUrl: GIFT_CTA.image,
  },
})
