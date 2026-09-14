import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

/**
 * Medium-impact hero — editorial column of copy on the cream ground, then a
 * full-width `rounded-sm` photograph. Near-square corners, no card chrome.
 */
export const MediumImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <section className="bg-brand-50 py-14 lg:py-20">
      <div className="container-editorial">
        <div className="max-w-[640px]">
          {richText && <RichText className="mb-0" data={richText} enableGutter={false} />}

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

        {media && typeof media === 'object' && (
          <div className="mt-12">
            <div className="overflow-hidden rounded-sm bg-brand-100">
              <Media imgClassName="w-full h-auto object-cover" priority resource={media} />
            </div>
            {media?.caption && (
              <div className="mt-3 font-sans text-[13px] text-gray-500">
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
