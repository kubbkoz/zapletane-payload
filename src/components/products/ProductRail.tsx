import type { Product } from '@/payload-types'

import { ProductGridItem } from '@/components/ProductGridItem'

type Props = {
  eyebrow: string
  heading: React.ReactNode
  products: Product[]
}

/**
 * Shared PDP product rail — used for both the „Mohlo by vás zaujať" upsell
 * rail and the „Súvisiace produkty" related rail. Same card grid the
 * homepage/listing pages use (`ProductGridItem`, per design.md §22's "one
 * card everywhere" rule) — no forked card markup. Renders nothing when the
 * relation resolved to no docs, so callers don't need to guard the empty case.
 */
export function ProductRail({ eyebrow, heading, products }: Props) {
  if (!products.length) return null

  return (
    <section className="section-band border-t border-gray-100 bg-white">
      <div className="container-editorial">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-h2 mt-4">{heading}</h2>
        <div className="section-decorator mt-6" />

        <div className="mt-10 grid grid-cols-2 gap-x-1 gap-y-8 md:gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <ProductGridItem key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
