'use client'
import React, { useCallback, useMemo } from 'react'

import { Category } from '@/payload-types'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import clsx from 'clsx'

type Props = {
  category: Category
}

/**
 * Listing category filter link. Quiet gray by default, brand brown when active —
 * the same "active = accent, inactive = gray-600 hover:brand" language the
 * navbar and the homepage product tabs use.
 */
export const CategoryItem: React.FC<Props> = ({ category }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = useMemo(() => {
    return searchParams.get('category') === String(category.id)
  }, [category.id, searchParams])

  const setQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (isActive) {
      params.delete('category')
    } else {
      params.set('category', String(category.id))
    }

    const newParams = params.toString()

    router.push(pathname + '?' + newParams)
  }, [category.id, isActive, pathname, router, searchParams])

  return (
    <button
      onClick={() => setQuery()}
      className={clsx(
        'flex w-full items-center border-l-2 py-1.5 pl-3 text-left font-sans text-[13px] transition-colors duration-150 hover:cursor-pointer',
        isActive
          ? 'border-brand font-semibold text-brand'
          : 'border-transparent text-gray-600 hover:border-brand-300 hover:text-black',
      )}
      type="button"
    >
      {category.title}
    </button>
  )
}
