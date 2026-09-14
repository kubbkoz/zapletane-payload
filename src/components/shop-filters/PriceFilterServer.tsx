import clsx from 'clsx'
import React, { Suspense } from 'react'

import { getPriceBounds } from './data'
import { PriceFilter } from './PriceFilter'

async function PriceFilterData() {
  const bounds = await getPriceBounds()
  return <PriceFilter bounds={bounds} />
}

const skeleton = 'h-11 animate-pulse rounded-default bg-gray-100'

/**
 * Server wrapper around `<PriceFilter>` — fetches the catalog min/max (for
 * placeholders/clamping) behind its own `Suspense` boundary, independent
 * from `<Categories>`'s. Keeps a slow price-bounds query from blanking out
 * the rest of the filter rail (or vice versa).
 */
export function PriceFilterServer() {
  return (
    <Suspense
      fallback={
        <div>
          <h3 className="form-label">Cena</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={skeleton} />
            <div className={skeleton} />
          </div>
          <div className={clsx(skeleton, 'mt-2')} />
        </div>
      }
    >
      <PriceFilterData />
    </Suspense>
  )
}
