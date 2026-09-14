import type { SloganContent } from '@/lib/homeDefaults'

import React from 'react'

import { SLOGAN } from '@/lib/homeDefaults'

type Props = {
  slogan?: SloganContent
}

/**
 * Brand pull-quote (DESIGN-SPEC §3.1). The one place in the whole layout where
 * the brand speaks instead of the catalogue — centred decorator rule above a
 * display-face H2 with the single brand-brown highlight word.
 *
 * The three parts are joined with a single space each, which is exactly what
 * JSX produced when the sentence was one hard-coded line.
 *
 * Unbounded has no italic cut, so nothing here is ever italicised.
 */
export const HomeSlogan: React.FC<Props> = ({ slogan = SLOGAN }) => {
  return (
    <section className="section-band bg-brand-50">
      <div className="container-editorial mx-auto max-w-3xl text-center">
        <div className="section-decorator mx-auto mb-8" />
        <h2 className="font-display text-2xl font-medium leading-snug tracking-tight text-black md:text-4xl">
          {slogan.before ? `${slogan.before} ` : null}
          {slogan.highlight ? <span className="text-brand">{slogan.highlight}</span> : null}
          {slogan.after ? ` ${slogan.after}` : null}
        </h2>
      </div>
    </section>
  )
}
