import type { Post } from '@/payload-types'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { PostCard } from '@/app/(app)/blog/PostCard'

type Props = {
  posts: Partial<Post>[]
}

/**
 * "Z nášho blogu" — closing editorial section (Z17), directly above the
 * footer. Same house style as the other homepage sections (see
 * HomeCategoryGrid/HomeGiftCta): eyebrow -> section-h2 -> section-decorator,
 * `PostCard` reused verbatim from the `/blog` listing (same card anatomy
 * everywhere an article is shown, per that component's own doc comment).
 *
 * Renders nothing on a fresh/empty database — same "hide the whole section"
 * convention every other data-backed homepage section already follows
 * (HomeCategoryGrid, HomeProductTabs) rather than showing an empty state.
 */
export const HomeBlogSection: React.FC<Props> = ({ posts }) => {
  if (!posts.length) return null

  return (
    <section className="section-band bg-brand-50">
      <div className="container-editorial">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Blog</p>
            <h2 className="section-h2 mt-4">Z nášho blogu</h2>
            <div className="section-decorator mt-6" />
          </div>

          <Link className="btn-primary group" href="/blog">
            Všetky články
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
