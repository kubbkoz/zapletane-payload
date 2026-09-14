/**
 * Hero slides — copy and imagery carried over verbatim from the ZAPLETANE
 * source (`app/utils/constants.ts` HERO_SLIDES). Same two slides, same Slovak
 * strings, same pre-compressed WebP shots that ship in /public.
 *
 * `hotspots` is part of the slide contract (the original hero can pin shoppable
 * markers onto the photo) but ships empty here, exactly as it does upstream —
 * so the hero degrades to plain photography until a real catalogue exists to
 * point the markers at.
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
export const HERO_PERKS = [
  { icon: 'Hand', label: 'Ručná výroba' },
  { icon: 'Leaf', label: 'Prírodné materiály' },
  { icon: 'Truck', label: 'Doručenie do 3 dní' },
] as const

/** Value cards (FEATURES in the Vue original) — reused by the homepage strip. */
export const FEATURES = [
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
] as const
