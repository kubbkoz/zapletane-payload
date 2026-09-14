import React from 'react'

/**
 * Brand pull-quote (DESIGN-SPEC §3.1). The one place in the whole layout where
 * the brand speaks instead of the catalogue — centred decorator rule above a
 * display-face H2 with the single brand-brown highlight word.
 *
 * Unbounded has no italic cut, so nothing here is ever italicised.
 */
export const HomeSlogan: React.FC = () => {
  return (
    <section className="section-band bg-brand-50">
      <div className="container-editorial mx-auto max-w-3xl text-center">
        <div className="section-decorator mx-auto mb-8" />
        <h2 className="font-display text-2xl font-medium leading-snug tracking-tight text-black md:text-4xl">
          Vyrábame veci, ktoré <span className="text-brand">zostávajú</span> — nie tie, ktoré sa
          vyhadzujú.
        </h2>
      </div>
    </section>
  )
}
