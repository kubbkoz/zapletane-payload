import type { Metadata } from 'next'
import type { Category, Post, Product } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import React from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { HomeBlogSection } from '@/components/home/HomeBlogSection'
import { HomeCategoryGrid } from '@/components/home/HomeCategoryGrid'
import { HomeFeatures } from '@/components/home/HomeFeatures'
import { HomeGiftCta } from '@/components/home/HomeGiftCta'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeProductTabs, type ProductTab } from '@/components/home/HomeProductTabs'
import { HomeSlogan } from '@/components/home/HomeSlogan'
import { ProductGridItem } from '@/components/ProductGridItem'
import {
  resolveCategorySection,
  resolveFeatures,
  resolveGiftCta,
  resolveHeroPerks,
  resolveHeroSlides,
  resolveProductTabs,
  resolveSlogan,
} from '@/lib/homeContent'
import { getHomepage } from '@/utilities/getHomepage'
import { JsonLd } from '@/seo/JsonLd'
import { buildWebsiteJsonLd } from '@/seo/jsonLd'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * ZAPLETANE homepage.
 *
 * Section order is editorial, not catalogue-driven — "brand → reason → product →
 * assortment → call-to-action" (DESIGN-SPEC §3.1): hero → slogan → values →
 * products → categories → gift CTA. Any blocks authored on the CMS `home` page
 * render underneath, so editorial content added later is never lost.
 *
 * All copy, imagery and the tab configuration come from the `homepage` global
 * (cached under `global_homepage`, revalidated by its own afterChange hook); the
 * resolvers in `src/lib/homeContent.ts` fall back to the constants the sections
 * used to hard-code, so an unreachable or half-filled global renders exactly
 * what shipped before.
 *
 * Every data-backed section returns null on an empty catalogue, so the page
 * still reads as a finished storefront against a fresh database.
 */

const CARD_SELECT = {
  title: true,
  slug: true,
  gallery: true,
  priceInEUR: true,
  inventory: true,
  enableVariants: true,
} as const

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

/**
 * Latest 3 published posts for the "Z nášho blogu" section (Z17).
 *
 * `Posts`' own `afterChange`/`afterDelete` hooks (src/collections/Posts.ts)
 * only `revalidatePath` the `/blog` routes, not `/` — there is no existing
 * tag a homepage listing could piggy-back on, so this is time-based only:
 * `revalidate: 300` is the ceiling, same as the other homepage reads
 * (`getHomepage.ts` uses 60s off its own global hook; a blog post is far
 * less time-sensitive). The tag is still declared for a future targeted
 * invalidation, it just has nothing revalidating it yet.
 */
const HOME_LATEST_POSTS_TAG = 'home-latest-posts'

const readLatestPosts = unstable_cache(
  async (): Promise<Partial<Post>[]> => {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'posts',
      depth: 1,
      draft: false,
      limit: 3,
      overrideAccess: false,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        heroImage: true,
        publishedAt: true,
      },
      sort: '-publishedAt',
      where: { _status: { equals: 'published' } },
    })
    return result.docs
  },
  ['home-latest-posts'],
  { revalidate: 300, tags: [HOME_LATEST_POSTS_TAG] },
)

async function queryLatestPosts(): Promise<Partial<Post>[]> {
  try {
    return await readLatestPosts()
  } catch (_err) {
    // Empty or unreachable database (fresh deploy) — the section simply hides.
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
  const homepage = await getHomepage()
  const tabsConfig = resolveProductTabs(homepage)

  const [tabProducts, categories, layout, latestPosts] = await Promise.all([
    Promise.all(tabsConfig.tabs.map((tab) => queryProducts(tab.sort))),
    queryCategories(),
    queryHomeLayout(),
    queryLatestPosts(),
  ])

  const tabs: ProductTab[] = tabsConfig.tabs
    .map((tab, index) => ({
      key: tab.key,
      label: tab.label,
      content: (tabProducts[index] || []).map((product) => (
        <ProductGridItem key={product.id} product={product} />
      )),
    }))
    .filter((tab, index) => (tabProducts[index] || []).length > 0)

  return (
    <React.Fragment>
      {/* `WebSite` + `SearchAction` (Z4): vyhľadávačom povie, že obchod má
          vlastné vyhľadávanie, a dá im tvar adresy, ktorý môžu ponúknuť priamo
          vo výsledkoch. Patrí na domovskú stránku, teda sem. */}
      <JsonLd data={buildWebsiteJsonLd(getServerSideURL())} />
      <HomeHero perks={resolveHeroPerks(homepage)} slides={resolveHeroSlides(homepage)} />
      <HomeSlogan slogan={resolveSlogan(homepage)} />
      <HomeFeatures content={resolveFeatures(homepage)} />
      {tabs.length > 0 && (
        <HomeProductTabs
          eyebrow={tabsConfig.eyebrow}
          tabs={tabs}
          titleBefore={tabsConfig.titleBefore}
          titleHighlight={tabsConfig.titleHighlight}
        />
      )}
      <HomeCategoryGrid categories={categories} content={resolveCategorySection(homepage)} />
      <HomeGiftCta content={resolveGiftCta(homepage)} />
      {layout?.length ? <RenderBlocks blocks={layout} /> : null}
      {/* Last section on the page, directly above the Footer that
          (app)/layout.tsx renders below `children` — see owner spec Z17. */}
      <HomeBlogSection posts={latestPosts} />
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
