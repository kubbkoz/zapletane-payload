'use client'

import React, { useEffect, useState } from 'react'

import type { PriceBounds } from './data'
import { parsePriceBoundary } from './filterParams'
import { useShopFilterUrl } from './useShopFilterUrl'

type Props = {
  bounds: PriceBounds
}

function formatEuro(value: number | undefined): string {
  if (value === undefined) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * "Cena" facet — Od/Do inputs + an explicit apply button (item 1 of the /shop
 * filter spec). Deliberately does NOT push a URL change on every keystroke —
 * only on submit — so typing a price doesn't refetch the listing on every
 * digit.
 */
export function PriceFilter({ bounds }: Props) {
  const { filters, setPriceRange } = useShopFilterUrl()
  const [minInput, setMinInput] = useState(() => formatEuro(filters.priceMinEUR))
  const [maxInput, setMaxInput] = useState(() => formatEuro(filters.priceMaxEUR))

  // Keep the fields in sync when the range changes from elsewhere (a chip's
  // remove button, "Zrušiť všetky", browser back/forward).
  useEffect(() => {
    setMinInput(formatEuro(filters.priceMinEUR))
    setMaxInput(formatEuro(filters.priceMaxEUR))
  }, [filters.priceMinEUR, filters.priceMaxEUR])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPriceRange(parsePriceBoundary(minInput), parsePriceBoundary(maxInput))
  }

  const minPlaceholder = bounds.minEUR !== null ? formatEuro(bounds.minEUR) : '0'
  const maxPlaceholder = bounds.maxEUR !== null ? formatEuro(bounds.maxEUR) : undefined

  return (
    <div>
      <h3 className="form-label">Cena</h3>
      {/* Stacked (2-col grid + full-width apply below) rather than one row —
          the desktop rail is a narrow fixed column, and inline Od/Do/Apply
          doesn't have room to breathe there. */}
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1.5 block font-sans text-[11px] text-gray-500">Od</span>
            <input
              className="form-input"
              inputMode="decimal"
              min={0}
              name="priceMin"
              placeholder={minPlaceholder}
              step="0.01"
              type="number"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1.5 block font-sans text-[11px] text-gray-500">Do</span>
            <input
              className="form-input"
              inputMode="decimal"
              min={0}
              name="priceMax"
              placeholder={maxPlaceholder}
              step="0.01"
              type="number"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
            />
          </label>
        </div>
        <button
          className="btn-accent-sm mt-2 inline-flex w-full items-center justify-center rounded-default"
          type="submit"
        >
          Použiť
        </button>
      </form>
    </div>
  )
}
