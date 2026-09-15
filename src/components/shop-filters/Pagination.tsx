import Link from 'next/link'
import React from 'react'

import type { SearchParamsInput } from './filterParams'

import { PAGE_PARAM } from './filterParams'

type Props = {
  currentPage: number
  /** The full raw `searchParams` object from `shop/page.tsx` — every other
   * active param (q, sort, category, price*, availability, f_<slug>) rides
   * along unchanged, only `page` itself is rewritten. */
  searchParams: SearchParamsInput
  totalPages: number
}

function hrefForPage(searchParams: SearchParamsInput, page: number): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === PAGE_PARAM || value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) {
      params.append(key, entry)
    }
  }

  // Page 1 is the default — keep the URL clean rather than writing `page=1`.
  if (page > 1) params.set(PAGE_PARAM, String(page))

  const query = params.toString()
  return `/shop${query ? `?${query}` : ''}`
}

/**
 * Simple prev/next pagination for the /shop grid (X4), driven by
 * `SiteSettings.search.resultsPerPage`. Plain server-rendered `<Link>`s
 * rather than client-side "load more" state — consistent with the rest of
 * /shop's URL-driven filtering (SSR-friendly, works with JS disabled, browser
 * back/forward "just works").
 */
export function Pagination({ currentPage, searchParams, totalPages }: Props) {
  if (totalPages <= 1) return null

  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <nav aria-label="Stránkovanie" className="mt-10 flex items-center justify-center gap-4">
      {hasPrev ? (
        <Link
          className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-[11px]"
          href={hrefForPage(searchParams, currentPage - 1)}
        >
          Predchádzajúce
        </Link>
      ) : null}

      <span className="font-sans text-[12px] text-gray-500">
        Strana {currentPage} z {totalPages}
      </span>

      {hasNext ? (
        <Link
          className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-[11px]"
          href={hrefForPage(searchParams, currentPage + 1)}
        >
          Načítať ďalšie
        </Link>
      ) : null}
    </nav>
  )
}
