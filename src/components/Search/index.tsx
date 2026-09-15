'use client'

import { cn } from '@/utilities/cn'
import { createUrl } from '@/utilities/createUrl'
import { SearchIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

type Props = {
  className?: string
  /** SiteSettings.search.placeholder (X4), passed down by `shop/layout.tsx`.
   * Falls back to the original hard-coded copy when unset — e.g. the global
   * has never been saved, or its `search` group is empty. */
  placeholder?: string
}

const DEFAULT_PLACEHOLDER = 'Hľadať produkt, kategóriu...'

/**
 * Storefront search field — the `form-input-with-icon` shortcut (DESIGN-SPEC
 * §1.4): cream fill, transparent border that turns brand-brown and the fill
 * white on focus, near-square corners, with the glyph riding in the left gutter.
 */
export const Search: React.FC<Props> = ({ className, placeholder }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const val = e.target as HTMLFormElement
    const search = val.search as HTMLInputElement
    const newParams = new URLSearchParams(searchParams.toString())

    if (search.value) {
      newParams.set('q', search.value)
    } else {
      newParams.delete('q')
    }
    // A new search always starts back at page 1.
    newParams.delete('page')

    router.push(createUrl('/shop', newParams))
  }

  return (
    <form className={cn('relative w-full', className)} onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="storefront-search">
        Hľadať
      </label>
      <input
        autoComplete="off"
        className="form-input-with-icon pr-28 placeholder:text-gray-400"
        defaultValue={searchParams?.get('q') || ''}
        id="storefront-search"
        key={searchParams?.get('q')}
        name="search"
        placeholder={placeholder || DEFAULT_PLACEHOLDER}
        type="text"
      />
      <div className="pointer-events-none absolute left-0 top-0 ml-4 flex h-full items-center text-gray-400">
        <SearchIcon className="h-4 w-4" />
      </div>
      <button
        aria-label="Hľadať"
        className="absolute right-1.5 top-1/2 flex h-9 -translate-y-1/2 items-center rounded-default bg-brand px-4 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors duration-200 hover:bg-brand-600"
        type="submit"
      >
        Hľadať
      </button>
    </form>
  )
}
