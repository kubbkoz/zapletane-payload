import { FilterList } from '@/components/layout/search/filter'
import { ShopFilters } from '@/components/shop-filters/ShopFilters'
import { sorting } from '@/lib/constants'
import { Search } from '@/components/Search'
import React, { Suspense } from 'react'

/**
 * Category-listing shell (DESIGN-SPEC §3.2). Editorial header — eyebrow, display
 * H1 with the single brand-brown highlight word, decorator rule — then the
 * search field, then a quiet left filter rail beside the card grid, all on the
 * warm cream page ground.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <div className="bg-brand-50">
        <div className="container-editorial py-12 lg:py-16">
          <p className="eyebrow">Sortiment</p>
          <h1 className="section-h2 mt-4">
            Naša <span className="text-brand">ponuka</span>
          </h1>
          <div className="section-decorator mt-6" />
          <p className="mt-6 max-w-[520px] text-[15px] leading-[1.75] text-gray-700">
            Ručne pletené deky, hračky a prútené dekorácie — každý kúsok vzniká pomaly a v malých
            sériách.
          </p>

          <Search className="mt-9 max-w-2xl" />

          <div className="mt-12 flex flex-col items-start gap-10 md:flex-row md:gap-12">
            <aside className="flex w-full flex-none flex-col gap-8 md:w-[220px]">
              <ShopFilters />
              <FilterList list={sorting} title="Zoradiť podľa" />
            </aside>

            <div className="min-h-[50vh] w-full">{children}</div>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
