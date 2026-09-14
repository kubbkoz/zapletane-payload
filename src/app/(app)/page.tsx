import type { Metadata } from 'next'
import type { Category, Product } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { HomeCategoryGrid } from '@/components/home/HomeCategoryGrid'
import { HomeFeatures } from '@/components/home/HomeFeatures'
import { HomeGiftCta } from '@/components/home/HomeGiftCta'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeProductTabs, type ProductTab } from '@/components/home/HomeProductTabs'
import { HomeSlogan } from '@/components/home/HomeSlogan'
import { ProductGridItem } from '@/components/ProductGridItem'

/**
 * ZAPLETANE homepage.
 *
 * Section order is editorial, not catalogue-driven — "brand → reason → product →
 * assortment → call-to-action" (DESIGN-SPEC §3.1): hero → slogan → values →
 * products → categories → gift CTA. Any blocks authored on the CMS `home` page
 * render underneath, so editorial content added later is never lost.
 *
 * Every data-backed section returns null on an empty catalogue, so the page
 * still reads as a finished storefront against a fresh database.
 */

const CARD_SELECT = {
  title: true,
  slug: true,
  gallery: true,
  priceInUSD: true,
  inventory: true,
  enableVariants: true,
} as const

const TABS: { key: string; label: string; sort: string }[] = [
  { key: 'new', label: 'Nové', sort: '-createdAt' },
  { key: 'all', label: 'Celá ponuka', sort: 'title' },
  { key: 'value', label: 'Najvýhodnejšie', sort: 'priceInUSD' },
]

async function queryProducts(sort: string): Promise<Partial<Product>[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      limit: 8,
      overrideAccess: false,
      select: CARD_SELECT,
      sort,
      where: { _status: { equals: 'published' } },
    })
    return result.docs
  } catch (_err) {
    // Empty or unreachable database (fresh deploy) — the section simply hides.
    return []
  }
}

async function queryCategories(): Promise<Category[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'categories',
      limit: 6,
      overrideAccess: false,
      sort: 'title',
    })
    return result.docs
  } catch (_err) {
    return []
  }
}

async function queryHomeLayout() {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'pages',
      draft: false,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      where: {
        and: [{ slug: { equals: 'home' } }, { _status: { equals: 'published' } }],
      },
    })
    return result.docs?.[0]?.layout ?? null
  } catch (_err) {
    return null
  }
}

export default async function HomePage() {
  const [tabProducts, categories, layout] = await Promise.all([
    Promise.all(TABS.map((tab) => queryProducts(tab.sort))),
    queryCategories(),
    queryHomeLayout(),
  ])

  const tabs: ProductTab[] = TABS.map((tab, index) => ({
    key: tab.key,
    label: tab.label,
    content: (tabProducts[index] || []).map((product) => (
      <ProductGridItem key={product.id} product={product} />
    )),
  })).filter((tab, index) => (tabProducts[index] || []).length > 0)

  return (
    <React.Fragment>
      <HomeHero />
      <HomeSlogan />
      <HomeFeatures />
      {tabs.length > 0 && <HomeProductTabs tabs={tabs} />}
      <HomeCategoryGrid categories={categories} />
      <HomeGiftCta />
      {layout?.length ? <RenderBlocks blocks={layout} /> : null}
    </React.Fragment>
  )
}

export const metadata: Metadata = {
  description:
    'Nakúpte ručne pletené deky a hračky, prútené dekorácie a doplnky online s doručením po celom Slovensku.',
  keywords:
    'pletené deky, pletené hračky, prútené dekorácie, prútené košíky, ručná výroba, handmade, doplnky',
  openGraph: {
    description:
      'Nakúpte ručne pletené deky a hračky, prútené dekorácie a doplnky online s doručením po celom Slovensku.',
    images: [{ url: '/assets/images/hero/hero-kolekcia.webp' }],
    locale: 'sk_SK',
    title: 'Ručne pletené a prútené kúsky pre váš domov',
    type: 'website',
  },
  title: 'Ručne pletené a prútené kúsky pre váš domov',
}
