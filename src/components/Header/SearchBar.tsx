'use client'

import { createUrl } from '@/utilities/createUrl'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Props = {
  className?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** SiteSettings.search.placeholder (X4). Optional and currently unused by
   * any caller — `HeaderClient`/`Header` (out of this component's ownership)
   * don't fetch or thread it through yet, see the handoff report's follow-up
   * note. Falls back to the original hard-coded copy either way, so this is
   * a no-op today and just leaves the prop ready for that wiring. */
  placeholder?: string
}

const DEFAULT_PLACEHOLDER = 'Hľadať produkt, kategóriu...'

/**
 * Header search — the input half of the Nuxt `SearchBar.vue` /
 * `search/SearchInput.vue` pair (DESIGN-SPEC.md §2.1): cream field with a
 * brown accent submit button welded to its right edge.
 *
 * The original's suggest dropdown (Shopware `/search/suggest`) has no
 * equivalent in this port, so submitting goes straight to the search results
 * page, the same `/shop?q=` contract the rest of the storefront already uses.
 *
 * Deliberately does not call `useSearchParams()`: this renders inside the root
 * layout on every route, and reading search params there would force every
 * otherwise-static page into client-side rendering.
 */
export function SearchBar({ className, inputRef, placeholder }: Props) {
  const router = useRouter()
  const [value, setValue] = useState('')

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const term = value.trim()
    if (!term) return

    const params = new URLSearchParams()
    params.set('q', term)

    router.push(createUrl('/shop', params))
  }

  return (
    // md, not lg: the 768–1023 band lost its only other search entry when the
    // hamburger menu dropped its SearchBar (the bottom bar + overlay are
    // md:hidden), so the header bar covers that band now.
    <div className={className ?? 'relative hidden max-w-2xl flex-1 md:flex'}>
      <form className="group relative flex w-full" onSubmit={onSubmit} role="search">
        <input
          aria-label="Hľadať produkt"
          autoComplete="off"
          className="w-full rounded-default border border-gray-200 bg-gray-50 py-3.5 pl-5 pr-16 font-sans text-sm tracking-wide text-black shadow-[inset_0_1px_3px_rgba(36,25,23,0.08)] transition-all duration-200 placeholder:text-gray-400 focus:border-brand focus:bg-white focus:shadow-[0_0_0_2px_rgba(117,86,80,1)] focus:outline-none hover:shadow-[0_0_0_1px_rgba(117,86,80,0.4)]"
          name="search"
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder || DEFAULT_PLACEHOLDER}
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={value}
        />

        {value ? (
          <button
            aria-label="Zmazať hľadanie"
            className="absolute right-12 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-gray-400 transition-colors hover:text-gray-700"
            onClick={() => {
              setValue('')
              inputRef?.current?.focus()
            }}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <button
          aria-label="Hľadať"
          className="group/btn absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-br-default rounded-tr-default bg-accent text-white transition-colors hover:bg-accent-dark"
          type="submit"
        >
          <Search className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
        </button>
      </form>
    </div>
  )
}
