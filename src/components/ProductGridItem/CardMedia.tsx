'use client'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { cn } from '@/utilities/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

type Props = {
  images: MediaType[]
  title: string
}

/**
 * Product-card image zone — 1:1 port of the slider in ProductCard.vue.
 *
 * The track is `transform: translateX()` driven (not native scroll), 500ms on
 * cubic-bezier(0.4,0,0.2,1), and carries the `bg-gray-50` backdrop itself: the
 * photos use `mix-blend-multiply` so a white product-photo background melts into
 * the card, and that blend only resolves if the gray surface lives on the SAME
 * compositing layer as the `will-change-transform` track (design.md §22.1) —
 * moving it onto a wrapper silently renders a white box instead.
 */
export const CardMedia: React.FC<Props> = ({ images, title }) => {
  const [current, setCurrent] = React.useState(0)
  const touchStartX = React.useRef(0)

  const count = images.length
  const hasMultiple = count > 1

  const go = React.useCallback(
    (next: number) => {
      if (!count) return
      setCurrent(((next % count) + count) % count)
    },
    [count],
  )

  if (!count) {
    return <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50" />
  }

  return (
    <div
      className="group/img relative aspect-[3/4] w-full overflow-hidden"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? 0
      }}
      onTouchEnd={(e) => {
        const endX = e.changedTouches[0]?.clientX ?? 0
        const deltaX = touchStartX.current - endX
        if (Math.abs(deltaX) > 50) go(current + (deltaX > 0 ? 1 : -1))
      }}
    >
      <div
        className="flex h-full w-full bg-gray-50 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {images.map((image, index) => (
          <div
            className="h-full w-full flex-shrink-0 overflow-hidden bg-transparent"
            key={`${image.id}-${index}`}
          >
            <Media
              className="h-full w-full"
              imgClassName="h-full w-full object-contain p-4 mix-blend-multiply pointer-events-none transition-transform duration-500 ease-out group-hover/img:scale-105"
              resource={image}
              size="(max-width: 768px) 50vw, 25vw"
              alt={`${title} — foto ${index + 1}`}
            />
          </div>
        ))}
      </div>

      {hasMultiple && (
        <React.Fragment>
          <button
            aria-label="Predošlý obrázok"
            className="pointer-events-auto absolute left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center border-none bg-transparent p-0 text-black/40 opacity-0 transition-all hover:text-black group-hover/img:opacity-100 md:flex"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              go(current - 1)
            }}
            type="button"
          >
            <ChevronLeft className="h-6 w-6 stroke-[1.5px]" />
          </button>
          <button
            aria-label="Ďalší obrázok"
            className="pointer-events-auto absolute right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center border-none bg-transparent p-0 text-black/40 opacity-0 transition-all hover:text-black group-hover/img:opacity-100 md:flex"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              go(current + 1)
            }}
            type="button"
          >
            <ChevronRight className="h-6 w-6 stroke-[1.5px]" />
          </button>

          {/* Progress bar — always visible on mobile, hover-only on desktop */}
          <div
            className={cn(
              'pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-gray-200/50 opacity-100 transition-opacity duration-300',
              'md:opacity-0 md:group-hover/img:opacity-100',
            )}
          >
            <div
              className="h-full bg-brand transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                width: `${100 / count}%`,
                transform: `translateX(${current * 100}%)`,
              }}
            />
          </div>
        </React.Fragment>
      )}
    </div>
  )
}
