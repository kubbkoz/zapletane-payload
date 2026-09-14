import type { GiftCtaContent } from '@/lib/homeDefaults'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { GIFT_CTA } from '@/lib/homeDefaults'

type Props = {
  content?: GiftCtaContent
}

/**
 * Closing call to action (DESIGN-SPEC §3.1). A light two-column card on the
 * cream ground — copy left, photograph right — deliberately NOT a full-width
 * dark band, which would break the editorial calm the rest of the page holds.
 * Slovak copy is the locale's own gift_cta_* strings, now editable in the
 * `homepage` global (an uploaded media item wins over the static path).
 */
export const HomeGiftCta: React.FC<Props> = ({ content = GIFT_CTA }) => {
  return (
    <section className="section-band bg-brand-50 pt-0">
      <div className="container-editorial">
        <div className="grid overflow-hidden rounded-sm bg-brand-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col justify-center px-8 py-12 lg:px-14">
            <h2 className="section-h2">{content.title}</h2>
            <p className="mt-5 max-w-[360px] text-[15px] leading-[1.75] text-gray-700">
              {content.text}
            </p>
            <Link className="btn-primary group mt-8 self-start" href={content.ctaHref || '/shop'}>
              {content.ctaLabel}
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
              src={content.image}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
