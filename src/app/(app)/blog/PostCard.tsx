import type { Media as MediaType, Post } from '@/payload-types'

import Link from 'next/link'
import React from 'react'
import { ArrowRight } from 'lucide-react'

import { Media } from '@/components/Media'
import { cn } from '@/utilities/cn'

/**
 * Karta článku — jediná karta, ktorú blog používa: vo výpise `/blog` aj v
 * lište „Ďalšie články" pod detailom. Anatómia je zámerne rovnaká ako pri
 * produktovej karte (`ProductGridItem`): tenký rám, ktorý na hover zčernie,
 * obrázok v pomere 3:2 nad textom, nadpis skrátený na dva riadky.
 */

const DATE_FORMATTER = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** „14. septembra 2026" — slovenský dátum bez času. */
export const formatPostDate = (value?: null | string): string => {
  if (!value) return ''

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : DATE_FORMATTER.format(date)
}

type Props = {
  className?: string
  post: Partial<Post>
}

export const PostCard: React.FC<Props> = ({ className, post }) => {
  const image =
    post.heroImage && typeof post.heroImage === 'object' ? (post.heroImage as MediaType) : null

  const published = formatPostDate(post.publishedAt)

  return (
    <Link
      aria-label={`Čítať článok ${post.title ?? ''}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-default border border-gray-200 bg-white transition-[box-shadow,border-color] duration-200 hover:border-black hover:shadow-card-hover',
        className,
      )}
      href={`/blog/${post.slug}`}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-brand-100">
        {image ? (
          <Media
            className="h-full w-full"
            imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            resource={image}
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {published ? (
          <time
            className="font-tech text-[11px] uppercase tracking-[0.18em] text-gray-500"
            dateTime={post.publishedAt ?? undefined}
          >
            {published}
          </time>
        ) : null}

        <h3 className="mt-3 line-clamp-2 font-display text-[19px] font-medium leading-snug text-black transition-colors duration-200 group-hover:text-brand">
          {post.title}
        </h3>

        {post.excerpt ? (
          <p className="mt-3 line-clamp-3 text-[13.5px] leading-[1.7] text-gray-600">
            {post.excerpt}
          </p>
        ) : null}

        <span className="mt-auto flex items-center gap-2 pt-6 font-sans text-[12px] font-medium uppercase tracking-wider text-brand">
          Čítať článok
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

export default PostCard
