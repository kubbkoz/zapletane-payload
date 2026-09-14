'use client'

import type { Product } from '@/payload-types'

import { Media } from '@/components/Media'
import { cn } from '@/utilities/cn'
import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'

import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { DefaultDocumentIDType } from 'payload'

type Props = {
  gallery: NonNullable<Product['gallery']>
}

/**
 * PDP gallery. Same card language as the listing: a cream/gray stage with the
 * photo `object-contain` + `mix-blend-multiply` so white studio backgrounds melt
 * into the surface, near-square corners (`rounded-sm`), and a thumbnail rail
 * whose active tile takes the espresso border (the same `border-black` accent
 * the product card uses on hover).
 *
 * Variant→image syncing logic below is unchanged from the template.
 */
export const Gallery: React.FC<Props> = ({ gallery }) => {
  const searchParams = useSearchParams()
  const [current, setCurrent] = React.useState(0)
  const [api, setApi] = React.useState<CarouselApi>()

  useEffect(() => {
    if (!api) {
      return
    }
  }, [api])

  useEffect(() => {
    const values = Array.from(searchParams.values())

    if (values && api) {
      const index = gallery.findIndex((item) => {
        if (!item.variantOption) return false

        let variantID: DefaultDocumentIDType

        if (typeof item.variantOption === 'object') {
          variantID = item.variantOption.id
        } else variantID = item.variantOption

        return Boolean(values.find((value) => value === String(variantID)))
      })
      if (index !== -1) {
        setCurrent(index)
        api.scrollTo(index, true)
      }
    }
  }, [searchParams, api, gallery])

  const hasThumbs = gallery.length > 1

  return (
    <div>
      <div className="relative mb-4 w-full overflow-hidden rounded-sm bg-gray-50">
        <div className="relative aspect-[4/5] w-full">
          <Media
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-6 mix-blend-multiply"
            priority
            resource={gallery[current].image}
          />
        </div>
      </div>

      {hasThumbs && (
        <Carousel setApi={setApi} className="w-full" opts={{ align: 'start', loop: false }}>
          <CarouselContent className="-ml-2">
            {gallery.map((item, i) => {
              if (typeof item.image !== 'object') return null

              return (
                <CarouselItem
                  className="basis-1/4 pl-2 sm:basis-1/5"
                  key={`${item.image.id}-${i}`}
                  onClick={() => setCurrent(i)}
                >
                  <button
                    aria-label={`Zobraziť foto ${i + 1}`}
                    className={cn(
                      'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border bg-gray-50 transition-colors duration-200',
                      i === current
                        ? 'border-black'
                        : 'border-gray-100 hover:border-brand-300',
                    )}
                    type="button"
                  >
                    <Media
                      className="h-full w-full"
                      imgClassName="h-full w-full object-contain p-2 mix-blend-multiply"
                      resource={item.image}
                    />
                  </button>
                </CarouselItem>
              )
            })}
          </CarouselContent>
        </Carousel>
      )}
    </div>
  )
}
