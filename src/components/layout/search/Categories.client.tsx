'use client'
import React from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { CategoryOption } from '@/components/shop-filters/data'
import { useShopFilterUrl } from '@/components/shop-filters/useShopFilterUrl'

type Props = {
  category: CategoryOption
}

/**
 * Listing category filter checkbox. Multi-select (DESIGN-SPEC item 3): the
 * `category` URL param now holds a comma-separated list of ids instead of a
 * single one, so several categories combine with OR semantics — toggling
 * one checkbox adds/removes just its id, every other active filter (`q`,
 * `sort`, price, availability, other categories) is preserved.
 *
 * Same "quiet gray by default, brand brown when active" language as the rest
 * of the sidebar, now expressed as a checked checkbox instead of a link
 * underline/border.
 */
export const CategoryFilterCheckbox: React.FC<Props> = ({ category }) => {
  const { filters, toggleCategory } = useShopFilterUrl()
  const checked = filters.categoryIds.includes(category.id)
  const id = `category-${category.id}`

  return (
    <Label
      className="cursor-pointer text-[13px] text-gray-600 data-[checked=true]:font-semibold data-[checked=true]:text-brand"
      data-checked={checked}
      htmlFor={id}
    >
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={() => toggleCategory(category.id)}
      />
      {category.title}
    </Label>
  )
}
