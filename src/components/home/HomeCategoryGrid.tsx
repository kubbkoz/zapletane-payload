import type { Category } from '@/payload-types'

import { ArrowRight, Package } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  categories: Category[]
}

/**
 * Assortment grid (DESIGN-SPEC §3.1). Editorial figure grid: the heading and CTA
 * hold their own narrow column on the left, the tiles are portrait 4:5 figures
 * with the caption BELOW the photo rather than overlaid — the same rhythm as the
 * rest of the page. Three tiles: a fourth would wrap to a lonely second row at
 * every breakpoint above sm.
 */
export const HomeCategoryGrid: React.FC<Props> = ({ categories }) => {
  const showcase = categories.slice(0, 3)

  if (!showcase.length) return null

  return (
    <section className="section-band bg-brand-50" id="kategorie">
      <div className="container-editorial grid gap-12 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="eyebrow">Sortiment</p>
          <h2 className="section-h2 mt-4">
            Vyberte si
            <br />
            <span className="text-brand">Kategóriu</span>
          </h2>
          <p className="mt-6 text-[15px] leading-[1.75] text-gray-700">
            Objavte našu ponuku ručne pletených diek, hračiek a prútených dekorácií
          </p>
          <Link className="btn-primary group mt-8" href="/shop">
            Prezrieť ponuku
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {showcase.map((category) => (
            <Link className="group" href={`/shop?category=${category.id}`} key={category.id}>
              <figure>
                <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-brand-100">
                  <div className="absolute inset-0 flex h-full w-full items-center justify-center text-brand transition-transform duration-500 ease-out group-hover:scale-105">
                    <Package className="size-8" strokeWidth={1.5} />
                  </div>
                </div>
                <figcaption className="mt-5">
                  <h3 className="font-sans text-[16px] font-semibold text-black transition-colors group-hover:text-brand">
                    {category.title}
                  </h3>
                </figcaption>
              </figure>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
