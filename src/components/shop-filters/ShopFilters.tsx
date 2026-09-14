import React from 'react'

import { Categories } from '@/components/layout/search/Categories'

import { MobileFiltersDrawer } from './MobileFiltersDrawer'
import { AvailabilityFilter } from './AvailabilityFilter'
import { PriceFilterServer } from './PriceFilterServer'

/**
 * /shop filter rail — Kategórie (multi-select), Cena, Dostupnosť.
 *
 * Desktop (>= md): all three render inline in the sidebar, the same spot the
 * old single-select `<Categories />` used to sit alone.
 * Mobile (< md): the same three collapse into `MobileFiltersDrawer`'s
 * slide-over behind a "Filtre" button with a count badge — the desktop block
 * is `hidden` there rather than removed, so both variants render from the
 * exact same children with no extra data plumbing to keep them in sync.
 *
 * Purely a synchronous composition — `<Categories>` and `<PriceFilterServer>`
 * each own their own data fetch + `Suspense` boundary internally, so neither
 * one loading blocks the other or the rest of the page.
 *
 * "Zoradiť podľa" (sorting) is NOT part of this component — it already has
 * its own responsive treatment (list on desktop, dropdown on mobile) via the
 * existing `<FilterList>` and stays a sibling of `<ShopFilters />` in
 * `shop/layout.tsx`.
 */
export function ShopFilters() {
  return (
    <>
      <div className="hidden flex-col gap-8 md:flex">
        <Categories />
        <PriceFilterServer />
        <AvailabilityFilter />
      </div>

      <div className="md:hidden">
        <MobileFiltersDrawer>
          <Categories />
          <PriceFilterServer />
          <AvailabilityFilter />
        </MobileFiltersDrawer>
      </div>
    </>
  )
}
