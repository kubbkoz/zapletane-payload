'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

/**
 * High-impact hero — full-bleed photograph with the copy sitting on a warm ink
 * scrim (`#241917`, never neutral black) so headline and links keep their
 * contrast (design.md §2 rule 3: white text, brand-400 links on dark).
 *
 * The template's `-mt-[10.4rem]` pull-up is deliberately gone: it hard-coded a
 * header height, and the ZAPLETANE navbar measures its own height at runtime.
 */
export const HighImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-black text-white">
      {media && typeof media === 'object' && (
        <Media
          className="absolute inset-0"
          fill
          imgClassName="object-cover opacity-60"
          priority
          resource={media}
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20"
      />

      <div className="container-editorial relative z-10 py-24">
        <div className="max-w-[640px]">
          {richText && (
            <RichText
              className="[&_*]:text-white [&_a]:text-brand-400"
              data={richText}
              enableGutter={false}
            />
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-4">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
