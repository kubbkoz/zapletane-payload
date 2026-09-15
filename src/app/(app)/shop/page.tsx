import { ProductGridItem } from '@/components/ProductGridItem'
import { ActiveFilterChips } from '@/components/shop-filters/ActiveFilterChips'
import { getCategoryOptions, getShopFilterConfig } from '@/components/shop-filters/data'
import {
  hasActiveFilters,
  parsePage,
  parseShopFilters,
  shopFiltersToWhere,
} from '@/components/shop-filters/filterParams'
import { Pagination } from '@/components/shop-filters/Pagination'
import { buildProductSearchClauses, resolveSearchConfig } from '@/lib/search'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import { getServerSideURL } from '@/utilities/getURL'
import { JsonLd } from '@/seo/JsonLd'
import { buildShopBreadcrumbJsonLd } from '@/seo/jsonLd'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { PackageSearch } from 'lucide-react'

export const metadata = {
  description: 'Ručne pletené deky, hračky a prútené dekorácie pre útulný domov.',
  title: 'Obchod',
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/** "1 produkt" / "2–4 produkty" / "5+ produktov" — Slovak plural rules. */
function productCountLabel(count: number): string {
  if (count === 1) return '1 produkt'
  if (count >= 2 && count <= 4) return `${count} produkty`
  return `${count} produktov`
}

/** "1 znak" / "2–4 znaky" / "5+ znakov" — same Slovak plural shape, for the
 * minChars hint. */
function charsLabel(count: number): string {
  if (count === 1) return '1 znak'
  if (count >= 2 && count <= 4) return `${count} znaky`
  return `${count} znakov`
}

export default async function ShopPage({ searchParams }: Props) {
  const rawSearchParams = await searchParams
  const { q: searchValue, sort } = rawSearchParams
  const filters = parseShopFilters(rawSearchParams)
  const hasCustomFilters = hasActiveFilters(filters)
  const page = parsePage(rawSearchParams.page)

  const payload = await getPayload({ config: configPromise })

  const [siteSettings, categoryOptions, filterConfig] = await Promise.all([
    getSiteSettings(),
    getCategoryOptions(),
    getShopFilterConfig(),
  ])

  // SiteSettings.search (X4) — falls back to the pre-existing behaviour
  // (2-char minimum, title+description, 12/page) whenever the global has no
  // explicit value, so an unsaved/failed read never breaks the page. Shared
  // with /api/search-suggest (Z1) so the overlay's live results and this page
  // always agree on what "a match" means.
  const { minChars, resultsPerPage, searchFields } = resolveSearchConfig(siteSettings)

  const rawSearch = Array.isArray(searchValue) ? searchValue[0] : searchValue
  const trimmedSearch = (rawSearch ?? '').trim()
  const searchTooShort = trimmedSearch.length > 0 && trimmedSearch.length < minChars
  // Below minChars: gently ignored server-side — same as no search at all —
  // rather than run a query that's almost certainly not what the visitor meant.
  const effectiveSearch = trimmedSearch.length > 0 && !searchTooShort ? trimmedSearch : undefined

  const searchOrClauses = effectiveSearch
    ? await buildProductSearchClauses(payload, effectiveSearch, searchFields)
    : []

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
    ...(sort ? { sort } : { sort: 'title' }),
    ...(searchOrClauses.length > 0 || hasCustomFilters
      ? {
          where: {
            and: [
              {
                _status: {
                  equals: 'published',
                },
              },
              ...(searchOrClauses.length > 0 ? [{ or: searchOrClauses }] : []),
              ...shopFiltersToWhere(filters),
            ],
          },
        }
      : {}),
  })

  const hasResults = products?.docs.length > 0
  const tagFilters = filterConfig.filter((filter) => filter.type === 'tags')

  return (
    <div>
      {/* Drobček Domov → Obchod v štruktúrovaných dátach (Z4). */}
      <JsonLd data={buildShopBreadcrumbJsonLd(getServerSideURL())} />
      <ActiveFilterChips categories={categoryOptions} tagFilters={tagFilters} />

      {searchTooShort ? (
        <p className="mb-8 font-sans text-[13px] text-gray-600">
          Napíšte aspoň {charsLabel(minChars)} na vyhľadávanie.
        </p>
      ) : effectiveSearch ? (
        <p className="mb-8 font-sans text-[13px] text-gray-600">
          {hasResults
            ? `Našli sme ${productCountLabel(products.docs.length)} pre `
            : 'Nenašli sme žiadny produkt pre '}
          <span className="font-bold text-black">&bdquo;{effectiveSearch}&ldquo;</span>
        </p>
      ) : hasResults ? (
        <p className="mb-8 font-sans text-[13px] text-gray-600">
          {productCountLabel(products.docs.length)} v ponuke
        </p>
      ) : null}

      {hasResults ? (
        <>
          <div className="grid grid-cols-2 gap-x-1 gap-y-8 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {products.docs.map((product) => {
              return <ProductGridItem key={product.id} product={product} />
            })}
          </div>

          <Pagination currentPage={page} searchParams={rawSearchParams} totalPages={products.totalPages} />
        </>
      ) : (
        /* Empty-DB / no-match state — the storefront still has to read as a shop. */
        <div className="card-editorial flex flex-col items-center px-8 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
            <PackageSearch className="size-7" strokeWidth={1.5} />
          </span>
          <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
            Zatiaľ tu nič nie je
          </h2>
          <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
            {searchValue || hasCustomFilters
              ? 'Skúste iné hľadanie alebo zrušte filtre — ponuku neustále dopĺňame o nové ručne pletené a prútené kúsky.'
              : 'Ponuku práve pripravujeme. Onedlho tu nájdete ručne pletené deky, hračky aj prútené dekorácie.'}
          </p>
          {(searchValue || hasCustomFilters) && (
            <Link className="btn-primary mt-8" href="/shop">
              Zobraziť všetko
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
