'use client'

import type { SortFilterItem as SortFilterItemType } from '@/lib/constants'

import { createUrl } from '@/utilities/createUrl'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React from 'react'

import type { ListItem } from '.'
import type { PathFilterItem as PathFilterItemType } from '.'

const itemClass =
  'flex w-full items-center border-l-2 py-1.5 pl-3 font-sans text-[13px] transition-colors duration-150'
const inactiveClass = 'border-transparent text-gray-600 hover:border-brand-300 hover:text-black'
const activeClass = 'border-brand font-semibold text-brand'

function PathFilterItem({ item }: { item: PathFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = pathname === item.path
  const newParams = new URLSearchParams(searchParams.toString())
  const DynamicTag = active ? 'p' : Link

  newParams.delete('q')
  newParams.delete('page')

  return (
    <li className="flex" key={item.title}>
      <DynamicTag
        className={clsx(itemClass, active ? activeClass : inactiveClass)}
        href={createUrl(item.path, newParams)}
      >
        {item.title}
      </DynamicTag>
    </li>
  )
}

function SortFilterItem({ item }: { item: SortFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get('sort') === item.slug
  // Preserve every other active param (q, category, priceMin/Max,
  // availability, ...) — only "sort" itself is rewritten, so changing sort
  // order never drops the filters currently applied.
  const newParams = new URLSearchParams(searchParams.toString())

  if (item.slug && item.slug.length) {
    newParams.set('sort', item.slug)
  } else {
    newParams.delete('sort')
  }
  newParams.delete('page')

  const href = createUrl(pathname, newParams)
  const DynamicTag = active ? 'p' : Link

  return (
    <li className="flex" key={item.title}>
      <DynamicTag
        className={clsx(itemClass, active ? activeClass : inactiveClass)}
        href={href}
        prefetch={!active ? false : undefined}
      >
        {item.title}
      </DynamicTag>
    </li>
  )
}

export function FilterItem({ item }: { item: ListItem }) {
  return 'path' in item ? <PathFilterItem item={item} /> : <SortFilterItem item={item} />
}
