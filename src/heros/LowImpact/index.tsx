import React from 'react'

import type { Page } from '@/payload-types'

import { RichText } from '@/components/RichText'

type LowImpactHeroType =
  | {
      children?: React.ReactNode
      richText?: never
    }
  | (Omit<Page['hero'], 'richText'> & {
      children?: never
      richText?: Page['hero']['richText']
    })

/**
 * Low-impact hero — a quiet page opener on the cream ground with the decorator
 * rule the rest of the system uses under section headings.
 */
export const LowImpactHero: React.FC<LowImpactHeroType> = ({ children, richText }) => {
  return (
    <section className="bg-brand-50 pb-10 pt-14 lg:pb-14 lg:pt-20">
      <div className="container-editorial">
        <div className="max-w-3xl">
          {children || (richText && <RichText data={richText} enableGutter={false} />)}
        </div>
        <div className="section-decorator mt-8" />
      </div>
    </section>
  )
}
