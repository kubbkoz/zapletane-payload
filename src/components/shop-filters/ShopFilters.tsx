import type { ProductFilter } from '@/payload-types'

import React from 'react'

import { Categories } from '@/components/layout/search/Categories'

import { AvailabilityFilter } from './AvailabilityFilter'
import { getShopFilterConfig } from './data'
import { MobileFiltersDrawer } from './MobileFiltersDrawer'
import { PriceFilterServer } from './PriceFilterServer'
import { TagFilter } from './TagFilter'

/** One admin-defined filter doc -> its rendered field. `key` is the doc's own
 * id so React can track it stably regardless of `sortOrder` changes. */
function renderFilterField(doc: ProductFilter): React.ReactNode {
  switch (doc.type) {
    case 'availability':
      return <AvailabilityFilter key={doc.id} />

    case 'categories': {
      const categoryIds = (doc.categories ?? [])
        .map((category) => (typeof category === 'number' ? category : category.id))
        .filter((id): id is number => typeof id === 'number')

      return <Categories categoryIds={categoryIds.length > 0 ? categoryIds : undefined} key={doc.id} />
    }

    case 'price':
      return <PriceFilterServer key={doc.id} />

    case 'tags':
      return (
        <TagFilter
          key={doc.id}
          label={doc.label}
          options={(doc.options ?? []).map((option) => ({ label: option.label, value: option.value }))}
          slug={doc.slug}
        />
      )

    default:
      return null
  }
}

/** Fresh element tree each call — rendered once for the desktop rail and
 * again for the mobile drawer (see `ShopFilters` below), so the two never
 * share React element identity even though they come from the same config. */
function renderFilterFields(config: ProductFilter[]): React.ReactNode {
  if (config.length === 0) {
    // Fallback — no `product-filters` docs exist (e.g. today's prod DB, or a
    // config read that failed). Renders exactly the original hard-coded
    // panel so nothing visibly changes until an admin creates filters.
    return (
      <>
        <Categories />
        <PriceFilterServer />
        <AvailabilityFilter />
      </>
    )
  }

  return config.map((doc) => renderFilterField(doc))
}

/**
 * /shop filter rail — dynamically generated from the `product-filters`
 * collection (X4), enabled docs ordered by `sortOrder`. Each doc's `type`
 * picks the field: `price` -> `PriceFilterServer`, `availability` ->
 * `AvailabilityFilter`, `categories` -> `Categories` (optionally restricted
 * to the doc's own `categories` relationship), `tags` -> `TagFilter` (the
 * doc's own `options` as checkboxes, `f_<slug>` in the URL).
 *
 * Falls back to the original fixed price/availability/categories panel when
 * no filter docs exist — see `renderFilterFields` — so the storefront is
 * unchanged until an admin actually configures filters.
 *
 * Desktop (>= md): all fields render inline in the sidebar, the same spot
 * the old fixed block used to sit.
 * Mobile (< md): the same fields collapse into `MobileFiltersDrawer`'s
 * slide-over behind a "Filtre" button with a count badge — the desktop
 * block is `hidden` there rather than removed, so both variants render from
 * the same config with no extra data plumbing to keep them in sync.
 *
 * "Zoradiť podľa" (sorting) is NOT part of this component — it already has
 * its own responsive treatment (list on desktop, dropdown on mobile) via the
 * existing `<FilterList>` and stays a sibling of `<ShopFilters />` in
 * `shop/layout.tsx`.
 */
export async function ShopFilters() {
  const config = await getShopFilterConfig()

  return (
    <>
      <div className="hidden flex-col gap-8 md:flex">{renderFilterFields(config)}</div>

      <div className="md:hidden">
        <MobileFiltersDrawer>{renderFilterFields(config)}</MobileFiltersDrawer>
      </div>
    </>
  )
}
