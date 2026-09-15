'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { createUrl } from '@/utilities/createUrl'

import type { AvailabilityValue, ShopFilters } from './filterParams'
import {
  AVAILABILITY_PARAM,
  CATEGORY_PARAM,
  PAGE_PARAM,
  PRICE_MAX_PARAM,
  PRICE_MIN_PARAM,
  TAG_FILTER_PARAM_PREFIX,
  parseShopFilters,
  searchParamsToInput,
  tagFilterParamName,
} from './filterParams'

/**
 * Single source of truth for reading + writing the /shop custom-filter URL
 * params from client components (category checkboxes, price apply button,
 * availability checkboxes, the chips row, the mobile drawer badge).
 *
 * Every mutator preserves every *other* current param (`q`, `sort`, and any
 * unknown one a link happened to carry) — only the facet being touched is
 * rewritten. Navigation uses `router.push` with `scroll: false` so toggling a
 * filter doesn't yank the page back to the top away from the sidebar/drawer.
 */
export function useShopFilterUrl() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parsed from the *whole* query string (not a cherry-picked subset of known
  // param names) — this is what lets `f_<slug>` tag-filter params parse here
  // without this hook needing to know which filters the `product-filters`
  // collection currently defines.
  const filters = useMemo<ShopFilters>(() => {
    return parseShopFilters(searchParamsToInput(searchParams))
  }, [searchParams])

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      // Any facet change can shrink the result set — never leave the visitor
      // stranded on a page number that no longer exists.
      params.delete(PAGE_PARAM)
      router.push(createUrl(pathname, params), { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const writeCategoryIds = useCallback(
    (params: URLSearchParams, ids: number[]) => {
      params.delete(CATEGORY_PARAM)
      if (ids.length > 0) params.set(CATEGORY_PARAM, ids.join(','))
    },
    [],
  )

  const writeAvailability = useCallback(
    (params: URLSearchParams, values: AvailabilityValue[]) => {
      params.delete(AVAILABILITY_PARAM)
      if (values.length > 0) params.set(AVAILABILITY_PARAM, values.join(','))
    },
    [],
  )

  const toggleCategory = useCallback(
    (id: number) => {
      const next = filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((existing) => existing !== id)
        : [...filters.categoryIds, id]
      navigate((params) => writeCategoryIds(params, next))
    },
    [filters.categoryIds, navigate, writeCategoryIds],
  )

  const toggleAvailability = useCallback(
    (value: AvailabilityValue) => {
      const next = filters.availability.includes(value)
        ? filters.availability.filter((existing) => existing !== value)
        : [...filters.availability, value]
      navigate((params) => writeAvailability(params, next))
    },
    [filters.availability, navigate, writeAvailability],
  )

  /** Both bounds are written together (the "Použiť" apply button) — pass
   * `undefined` for a side to clear it. */
  const setPriceRange = useCallback(
    (minEUR: number | undefined, maxEUR: number | undefined) => {
      navigate((params) => {
        params.delete(PRICE_MIN_PARAM)
        params.delete(PRICE_MAX_PARAM)
        if (minEUR !== undefined) params.set(PRICE_MIN_PARAM, String(minEUR))
        if (maxEUR !== undefined) params.set(PRICE_MAX_PARAM, String(maxEUR))
      })
    },
    [navigate],
  )

  const removeCategory = useCallback(
    (id: number) => {
      navigate((params) =>
        writeCategoryIds(
          params,
          filters.categoryIds.filter((existing) => existing !== id),
        ),
      )
    },
    [filters.categoryIds, navigate, writeCategoryIds],
  )

  const removeAvailability = useCallback(
    (value: AvailabilityValue) => {
      navigate((params) =>
        writeAvailability(
          params,
          filters.availability.filter((existing) => existing !== value),
        ),
      )
    },
    [filters.availability, navigate, writeAvailability],
  )

  const removePriceMin = useCallback(() => {
    navigate((params) => params.delete(PRICE_MIN_PARAM))
  }, [navigate])

  const removePriceMax = useCallback(() => {
    navigate((params) => params.delete(PRICE_MAX_PARAM))
  }, [navigate])

  const writeTagOptions = useCallback((params: URLSearchParams, slug: string, values: string[]) => {
    const paramName = tagFilterParamName(slug)
    params.delete(paramName)
    if (values.length > 0) params.set(paramName, values.join(','))
  }, [])

  const toggleTagOption = useCallback(
    (slug: string, value: string) => {
      const current = filters.tags[slug] ?? []
      const next = current.includes(value)
        ? current.filter((existing) => existing !== value)
        : [...current, value]
      navigate((params) => writeTagOptions(params, slug, next))
    },
    [filters.tags, navigate, writeTagOptions],
  )

  const removeTagOption = useCallback(
    (slug: string, value: string) => {
      const current = filters.tags[slug] ?? []
      navigate((params) =>
        writeTagOptions(
          params,
          slug,
          current.filter((existing) => existing !== value),
        ),
      )
    },
    [filters.tags, navigate, writeTagOptions],
  )

  /** Clears only the custom filters (category/price/availability/tags) —
   * search text and sort order are deliberately left alone, they have their
   * own dedicated controls with their own "back to default" affordance. */
  const clearAllFilters = useCallback(() => {
    navigate((params) => {
      params.delete(CATEGORY_PARAM)
      params.delete(PRICE_MIN_PARAM)
      params.delete(PRICE_MAX_PARAM)
      params.delete(AVAILABILITY_PARAM)
      // Tag-filter params are dynamically slugged (`f_<slug>`) — collect the
      // keys first, deleting mid-iteration over a live URLSearchParams can
      // skip entries.
      for (const key of Array.from(params.keys())) {
        if (key.startsWith(TAG_FILTER_PARAM_PREFIX)) params.delete(key)
      }
    })
  }, [navigate])

  return {
    filters,
    toggleCategory,
    toggleAvailability,
    toggleTagOption,
    setPriceRange,
    removeCategory,
    removeAvailability,
    removeTagOption,
    removePriceMin,
    removePriceMax,
    clearAllFilters,
  }
}
