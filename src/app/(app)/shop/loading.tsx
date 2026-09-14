import React from 'react'

/** Listing skeleton — mirrors the real card: 3/4 photo stage, then text rows. */
export default function Loading() {
  return (
    <div className="grid grid-cols-2 gap-x-1 gap-y-8 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
      {Array(9)
        .fill(0)
        .map((_, index) => {
          return (
            <div
              className="overflow-hidden rounded-default border border-gray-100 bg-white"
              key={index}
            >
              <div className="aspect-[3/4] animate-pulse bg-gray-100" />
              <div className="space-y-2 p-2 md:p-4">
                <div className="h-3 w-3/4 animate-pulse rounded-sm bg-gray-200" />
                <div className="h-3 w-1/3 animate-pulse rounded-sm bg-gray-200" />
                <div className="mt-3 h-5 w-2/5 animate-pulse rounded-sm bg-gray-200" />
              </div>
            </div>
          )
        })}
    </div>
  )
}
