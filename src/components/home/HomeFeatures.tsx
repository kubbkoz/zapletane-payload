import type { FeaturesContent } from '@/lib/homeDefaults'

import React from 'react'

import { ContentIcon } from '@/components/ContentIcon'
import { FEATURES } from '@/lib/homeDefaults'

type Props = {
  content?: FeaturesContent
}

/**
 * Value cards (DESIGN-SPEC §3.1 "Features" / §2.3 trust strip). Editorial header
 * — kicker + headline left, the paragraph right-aligned onto the same baseline —
 * above a row of thin-bordered `card-editorial` tiles on the cream ground.
 *
 * The headline is a textarea in the CMS: each line break becomes a <br>, which
 * is how the two-line default ("Ručná práca, / ktorá vydrží generácie") keeps
 * its shape.
 */
export const HomeFeatures: React.FC<Props> = ({ content = FEATURES }) => {
  const headingLines = content.heading.split('\n')

  return (
    <section className="section-band bg-brand-50" id="preco">
      <div className="container-editorial">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h2 className="section-h2 mt-4">
              {headingLines.map((line, index) => (
                <React.Fragment key={index}>
                  {index > 0 ? <br /> : null}
                  {line}
                </React.Fragment>
              ))}
            </h2>
          </div>
          <p className="max-w-[420px] text-[15px] leading-[1.75] text-gray-700 lg:justify-self-end">
            {content.text}
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {content.cards.map((feature) => (
            <div
              className="card-editorial flex h-full flex-col items-center px-8 py-10 text-center"
              key={feature.title}
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
                <ContentIcon className="size-7" name={feature.icon} strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 font-sans text-[16px] font-semibold text-black">
                {feature.title}
              </h3>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-gray-700">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
