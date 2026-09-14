'use client'

import { XIcon } from 'lucide-react'
import React from 'react'

import type { CategoryOption } from './data'
import { AVAILABILITY_OPTIONS } from './filterParams'
import { useShopFilterUrl } from './useShopFilterUrl'

type Props = {
  categories: CategoryOption[]
}

const chipClass =
  'inline-flex items-center gap-1.5 rounded-default border border-brand-300 bg-brand-100 py-1.5 pl-3 pr-2 font-sans text-[12px] font-medium text-brand-800'

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className={chipClass}>
      {label}
      <button
        aria-label={`Odstrániť filter ${label}`}
        className="flex size-4 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-300 hover:text-brand-800"
        onClick={onRemove}
        type="button"
      >
        <XIcon className="size-3" strokeWidth={2.5} />
      </button>
    </span>
  )
}

function formatEuroLabel(value: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return `${formatted} €`
}

/**
 * Removable chips row for the active category/price/availability filters,
 * plus "Zrušiť všetky". Renders nothing when no custom filter is active.
 * `q` (search text) and `sort` are intentionally not represented here — they
 * already have their own dedicated controls (the search field, the sort
 * list) with their own way back to the default state.
 */
export function ActiveFilterChips({ categories }: Props) {
  const {
    filters,
    removeCategory,
    removeAvailability,
    removePriceMin,
    removePriceMax,
    clearAllFilters,
  } = useShopFilterUrl()

  const categoryById = new Map(categories.map((category) => [category.id, category.title]))
  const availabilityLabel = new Map(AVAILABILITY_OPTIONS.map((opt) => [opt.value, opt.label]))

  const hasAny =
    filters.categoryIds.length > 0 ||
    filters.availability.length > 0 ||
    filters.priceMinEUR !== undefined ||
    filters.priceMaxEUR !== undefined

  if (!hasAny) return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {filters.categoryIds.map((id) => (
        <Chip
          key={`category-${id}`}
          label={categoryById.get(id) ?? `Kategória #${id}`}
          onRemove={() => removeCategory(id)}
        />
      ))}

      {filters.priceMinEUR !== undefined && (
        <Chip label={`Od ${formatEuroLabel(filters.priceMinEUR)}`} onRemove={removePriceMin} />
      )}
      {filters.priceMaxEUR !== undefined && (
        <Chip label={`Do ${formatEuroLabel(filters.priceMaxEUR)}`} onRemove={removePriceMax} />
      )}

      {filters.availability.map((value) => (
        <Chip
          key={`availability-${value}`}
          label={availabilityLabel.get(value) ?? value}
          onRemove={() => removeAvailability(value)}
        />
      ))}

      <button
        className="font-sans text-[12px] font-semibold text-gray-600 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-brand"
        onClick={clearAllFilters}
        type="button"
      >
        Zrušiť všetky
      </button>
    </div>
  )
}
