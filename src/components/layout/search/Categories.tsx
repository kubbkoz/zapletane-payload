import configPromise from '@payload-config'
import { getPayload } from 'payload'
import clsx from 'clsx'
import React, { Suspense } from 'react'

import { CategoryItem } from './Categories.client'

async function CategoryList() {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    sort: 'title',
  })

  if (!categories.docs.length) return null

  return (
    <nav>
      <h3 className="form-label">Kategórie</h3>

      <ul className="flex flex-col">
        {categories.docs.map((category) => {
          return (
            <li key={category.id}>
              <CategoryItem category={category} />
            </li>
          )
        })}
      </ul>
    </nav>
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
