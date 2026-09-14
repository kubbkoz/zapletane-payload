import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

/**
 * Closing call to action (DESIGN-SPEC §3.1). A light two-column card on the
 * cream ground — copy left, photograph right — deliberately NOT a full-width
 * dark band, which would break the editorial calm the rest of the page holds.
 * Slovak copy is the locale's own gift_cta_* strings.
 */
export const HomeGiftCta: React.FC = () => {
  return (
    <section className="section-band bg-brand-50 pt-0">
      <div className="container-editorial">
        <div className="grid overflow-hidden rounded-sm bg-brand-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col justify-center px-8 py-12 lg:px-14">
            <h2 className="section-h2">Hľadáte darček, ktorý poteší?</h2>
            <p className="mt-5 max-w-[360px] text-[15px] leading-[1.75] text-gray-700">
              Ručne vyrobené kúsky s dušou — pre blízkych, ktorí si zaslúžia niečo výnimočné.
            </p>
            <Link className="btn-primary group mt-8 self-start" href="/shop">
              Nájsť darček
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative min-h-[320px] lg:min-h-[420px]">
            <Image
              alt=""
              aria-hidden="true"
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              src="/assets/images/hero/hero-zahrada.webp"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
