import clsx from 'clsx'
import React, { Suspense } from 'react'

import { getCategoryOptions } from '@/components/shop-filters/data'

import { CategoryFilterCheckbox } from './Categories.client'

async function CategoryList() {
  const categories = await getCategoryOptions()

  if (!categories.length) return null

  return (
    <div>
      <h3 className="form-label">Kategórie</h3>

      <ul className="flex flex-col gap-2.5">
        {categories.map((category) => {
          return (
            <li key={category.id}>
              <CategoryFilterCheckbox category={category} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const skeleton = 'mb-3 h-3 w-5/6 animate-pulse rounded-sm'
const activeAndTitles = 'bg-gray-300'
const items = 'bg-gray-200'

export function Categories() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex-none py-2">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  )
}
