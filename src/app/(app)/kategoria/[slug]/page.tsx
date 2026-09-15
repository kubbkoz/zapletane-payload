import type { Metadata } from 'next'
import type { Category } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import React, { cache } from 'react'
import { PackageSearch } from 'lucide-react'

import { FilterList } from '@/components/layout/search/filter'
import { Pager } from '@/components/Pager'
import { ProductGridItem } from '@/components/ProductGridItem'
import { parsePage, parseShopFilters, shopFiltersToWhere } from '@/components/shop-filters/filterParams'
import { sorting } from '@/lib/constants'
import { resolveRedirect } from '@/lib/redirects'
import { resolveSearchConfig } from '@/lib/search'
import { JsonLd } from '@/seo/JsonLd'
import { buildCategoryBreadcrumbJsonLd } from '@/seo/jsonLd'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * `/kategoria/<slug>` — vstupná stránka kategórie (Z7).
 *
 * Doteraz sa kategória dala zobraziť len ako `/shop?category=<id>`. To je pre
 * návštevníka v poriadku, pre vyhľadávač nie: parameter v adrese je pre neho
 * duplicitná verzia obchodu, nie samostatná stránka, ktorá by sa dala
 * zaindexovať na „pletené deky". Táto routa dáva kategórii vlastnú kanonickú
 * adresu, vlastný `<title>` a drobček Domov → Obchod → kategória.
 *
 * Výpis je ten istý, aký beží na `/shop`: rovnaké parsovanie parametrov
 * (`parseShopFilters`), rovnaký prevod na dopyt (`shopFiltersToWhere`),
 * rovnaká karta (`ProductGridItem`) aj rovnaké radenie. Jediný rozdiel je, že
 * kategória nepochádza z adresy, ale z tejto stránky — a nedá sa odkliknúť.
 *
 * Čo tu zámerne NIE JE: panel filtrov s odškrtávaním kategórií. Na stránke,
 * ktorá *je* kategóriou, by ponúkal odchod preč z vlastnej kanonickej adresy.
 * Kto chce kombinovať kategórie, má na to `/shop`.
 */

const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'

type Args = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const queryCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1,
      pagination: false,
      where: { slug: { equals: slug } },
    })

    return result.docs?.[0] ?? null
  } catch {
    return null
  }
})

/** Premenovaná kategória: stará adresa dostane 301 skôr, než padne 404. */
const redirectIfRenamed = async (slug: string): Promise<void> => {
  const redirectTo = await resolveRedirect(`/kategoria/${slug}`)

  if (redirectTo) permanentRedirect(redirectTo)
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const category = await queryCategoryBySlug(slug)

  if (!category) {
    await redirectIfRenamed(slug)

    return { title: 'Kategória sa nenašla' }
  }

  const url = `${getServerSideURL().replace(/\/$/, '')}/kategoria/${category.slug}`
  const title = `${category.title} | ${SITE_NAME}`
  const description = `${category.title} — ručne pletené a prútené kúsky z dielne ${SITE_NAME}.`

  return {
    alternates: { canonical: url },
    description,
    openGraph: {
      description,
      locale: 'sk_SK',
      siteName: SITE_NAME,
      title,
      type: 'website',
      url,
    },
    title: { absolute: title },
  }
}

/** „1 produkt" / „2–4 produkty" / „5+ produktov" — rovnaké tvary ako v obchode. */
const productCountLabel = (count: number): string => {
  if (count === 1) return '1 produkt'
  if (count >= 2 && count <= 4) return `${count} produkty`

  return `${count} produktov`
}

export default async function CategoryPage({ params, searchParams }: Args) {
  const { slug } = await params
  const category = await queryCategoryBySlug(slug)

  if (!category) {
    await redirectIfRenamed(slug)

    return notFound()
  }

  const rawSearchParams = await searchParams
  const page = parsePage(rawSearchParams.page)
  const sort = Array.isArray(rawSearchParams.sort) ? rawSearchParams.sort[0] : rawSearchParams.sort

  // Ostatné filtre (cena, dostupnosť, štítky) prejdú z adresy nezmenené —
  // kategória sa len natvrdo prepíše na tú, ktorej stránka toto je.
  const filters = { ...parseShopFilters(rawSearchParams), categoryIds: [category.id] }

  const siteSettings = await getSiteSettings()
  const { resultsPerPage } = resolveSearchConfig(siteSettings)

  const payload = await getPayload({ config: configPromise })

  const products = await payload.find({
    collection: 'products',
    draft: false,
    limit: resultsPerPage,
    overrideAccess: false,
    page,
    select: {
      title: true,
      slug: true,
      gallery: true,
      categories: true,
      priceInEUR: true,
      inventory: true,
      enableVariants: true,
    },
    sort: sort || 'title',
    where: {
      and: [{ _status: { equals: 'published' } }, ...shopFiltersToWhere(filters)],
    },
  })

  const hasResults = products.docs.length > 0

  return (
    <div className="bg-brand-50">
      <JsonLd data={buildCategoryBreadcrumbJsonLd(category, getServerSideURL())} />

      <div className="container-editorial py-12 lg:py-16">
        <p className="eyebrow">Kategória</p>
        <h1 className="section-h2 mt-4">{category.title}</h1>
        <div className="section-decorator mt-6" />

        <nav aria-label="Drobčeková navigácia" className="mt-6 font-sans text-[12px] text-gray-600">
          <Link className="transition-colors hover:text-brand" href="/">
            Domov
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link className="transition-colors hover:text-brand" href="/shop">
            Obchod
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-black">{category.title}</span>
        </nav>

        <div className="mt-12 flex flex-col items-start gap-10 md:flex-row md:gap-12">
          <aside className="flex w-full flex-none flex-col gap-8 md:w-[220px]">
            <FilterList list={sorting} title="Zoradiť podľa" />
            <Link
              className="font-sans text-[12px] font-medium uppercase tracking-wider text-gray-600 transition-colors hover:text-brand"
              href="/shop"
            >
              Zobraziť celú ponuku
            </Link>
          </aside>

          <div className="min-h-[50vh] w-full">
            {hasResults ? (
              <>
                <p className="mb-8 font-sans text-[13px] text-gray-600">
                  {productCountLabel(products.totalDocs)} v kategórii
                </p>

                <div className="grid grid-cols-2 gap-x-1 gap-y-8 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
                  {products.docs.map((product) => (
                    <ProductGridItem key={product.id} product={product} />
                  ))}
                </div>

                <Pager
                  basePath={`/kategoria/${category.slug}`}
                  currentPage={page}
                  searchParams={rawSearchParams}
                  totalPages={products.totalPages}
                />
              </>
            ) : (
              <div className="card-editorial flex flex-col items-center px-8 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
                  <PackageSearch className="size-7" strokeWidth={1.5} />
                </span>
                <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
                  Zatiaľ tu nič nie je
                </h2>
                <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
                  V tejto kategórii práve nemáme žiadny kúsok. Pozrite si celú ponuku — dopĺňame ju
                  priebežne.
                </p>
                <Link className="btn-primary mt-8" href="/shop">
                  Zobraziť všetko
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
