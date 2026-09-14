import { Heart, Leaf, Sparkles, Truck } from 'lucide-react'
import React from 'react'

import { FEATURES } from './heroSlides'

const icons: Record<string, React.ElementType> = { Heart, Leaf, Sparkles, Truck }

/**
 * Value cards (DESIGN-SPEC §3.1 "Features" / §2.3 trust strip). Editorial header
 * — kicker + headline left, the paragraph right-aligned onto the same baseline —
 * above a row of thin-bordered `card-editorial` tiles on the cream ground.
 */
export const HomeFeatures: React.FC = () => {
  return (
    <section className="section-band bg-brand-50" id="preco">
      <div className="container-editorial">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="eyebrow">Prečo Zapletane</p>
            <h2 className="section-h2 mt-4">
              Ručná práca,
              <br />
              ktorá vydrží generácie
            </h2>
          </div>
          <p className="max-w-[420px] text-[15px] leading-[1.75] text-gray-700 lg:justify-self-end">
            Každý kúsok vzniká pomaly a v malých sériách. Nie preto, že by sme nevedeli rýchlejšie —
            ale preto, že rýchlo sa to spraviť nedá.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = icons[feature.icon]
            return (
              <div
                className="card-editorial flex h-full flex-col items-center px-8 py-10 text-center"
                key={feature.title}
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
                  {Icon ? <Icon className="size-7" strokeWidth={1.5} /> : null}
                </span>
                <h3 className="mt-6 font-sans text-[16px] font-semibold text-black">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.7] text-gray-700">{feature.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
