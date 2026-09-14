import { cn } from '@/utilities/cn'
import React from 'react'

import type { Product } from '@/payload-types'

import { ProductGridItem } from '@/components/ProductGridItem'

export type Props = {
  posts: Product[]
}

/**
 * Archive grid. Uses the one shared ZAPLETANE product card (design.md §22: every
 * listing, carousel and section renders `ProductGridItem`, never an inline
 * template), on the standard listing grid rhythm.
 */
export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  if (!posts?.length) return null

  return (
    <div className={cn('container-editorial')}>
      <div className="grid grid-cols-2 gap-x-1 gap-y-8 md:gap-4 lg:grid-cols-4">
        {posts?.map((result, index) => {
          if (typeof result === 'object' && result !== null) {
            return <ProductGridItem key={result.id ?? index} product={result} />
          }

          return null
        })}
      </div>
    </div>
  )
}
