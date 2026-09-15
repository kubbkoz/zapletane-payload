import type { Metadata } from 'next'
import type { Media as MediaType, Post } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import React, { cache } from 'react'
import { ChevronLeftIcon } from 'lucide-react'

import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'
import { JsonLd } from '@/seo/JsonLd'
import { buildArticleJsonLd, buildPostBreadcrumbJsonLd } from '@/seo/jsonLd'
import { resolveRedirect } from '@/lib/redirects'
import { getServerSideURL } from '@/utilities/getURL'

import { formatPostDate, PostCard } from '../PostCard'

/**
 * `/blog/<slug>` — detail článku (Z7).
 *
 * Skladba: úvodný obrázok → dátum a nadpis → text z lexikálneho editora →
 * návrat na výpis → tri najnovšie ďalšie články.
 *
 * SEO: `alternates.canonical` na túto adresu, OG typ `article` (nie `website`,
 * ako má produkt — vyhľadávače z toho čítajú dátum vydania a autora), a dve
 * štruktúrované dáta: `Article` a drobček `Domov → Blog → článok`. Koncept sa
 * nikdy neindexuje, aj keď je cez náhľad verejne dostupný — rovnako ako na
 * stránke produktu.
 */

const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'

type Args = {
  params: Promise<{
    slug: string
  }>
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }): Promise<null | Post> => {
  const { isEnabled: draft } = await draftMode()

  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'posts',
      depth: 2,
      draft,
      limit: 1,
      overrideAccess: draft,
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })

    return result.docs?.[0] ?? null
  } catch {
    return null
  }
})

/** Tri najnovšie iné články do lišty pod textom. */
const queryRelatedPosts = async ({ excludeId }: { excludeId: number | string }) => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'posts',
      depth: 1,
      draft: false,
      limit: 3,
      overrideAccess: false,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        heroImage: true,
        publishedAt: true,
      },
      sort: '-publishedAt',
      where: {
        and: [{ _status: { equals: 'published' } }, { id: { not_equals: excludeId } }],
      },
    })

    return result.docs
  } catch {
    return []
  }
}

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config: configPromise })

    const posts = await payload.find({
      collection: 'posts',
      draft: false,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: { slug: true },
      where: { _status: { equals: 'published' } },
    })

    return posts.docs.filter((post) => Boolean(post.slug)).map(({ slug }) => ({ slug: slug! }))
  } catch {
    // Databáza nemusí byť dostupná pri builde — články sa vykreslia na požiadanie.
    return []
  }
}

/** Premenovaný článok: stará adresa dostane 301 skôr, než padne 404. */
const redirectIfRenamed = async (slug: string): Promise<void> => {
  const redirectTo = await resolveRedirect(`/blog/${slug}`)

  if (redirectTo) permanentRedirect(redirectTo)
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  if (!post) {
    await redirectIfRenamed(slug)

    return { title: 'Článok sa nenašiel' }
  }

  const siteUrl = getServerSideURL().replace(/\/$/, '')
  const url = `${siteUrl}/blog/${post.slug}`

  const title = post.meta?.title?.trim() || `${post.title} | ${SITE_NAME}`
  const description =
    post.meta?.description?.trim() || post.excerpt?.trim() || `${post.title} — ${SITE_NAME}.`

  const metaImage = typeof post.meta?.image === 'object' ? (post.meta.image as MediaType) : null
  const heroImage = typeof post.heroImage === 'object' ? (post.heroImage as MediaType) : null
  const imageUrl = metaImage?.url || heroImage?.url

  const images = imageUrl ? [{ alt: post.title, url: `${siteUrl}${imageUrl}` }] : undefined

  const canIndex = post._status === 'published'

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      authors: [SITE_NAME],
      description,
      images,
      locale: 'sk_SK',
      modifiedTime: post.updatedAt ?? undefined,
      publishedTime: post.publishedAt ?? undefined,
      siteName: SITE_NAME,
      title,
      type: 'article',
      url,
    },
    robots: {
      follow: canIndex,
      googleBot: { follow: canIndex, index: canIndex },
      index: canIndex,
    },
    // `absolute`, lebo koreňový layout pridáva šablónu „%s | ZAPLETANE" —
    // značka je v titulku už raz, dvakrát by tam byť nemala.
    title: { absolute: title },
    twitter: {
      card: 'summary_large_image',
      description,
      images: images?.map((image) => image.url),
      title,
    },
  }
}

export default async function PostPage({ params }: Args) {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  if (!post) {
    await redirectIfRenamed(slug)

    return notFound()
  }

  const siteUrl = getServerSideURL()
  const base = siteUrl.replace(/\/$/, '')

  const heroImage = typeof post.heroImage === 'object' ? (post.heroImage as MediaType) : null
  const metaImage = typeof post.meta?.image === 'object' ? (post.meta.image as MediaType) : null

  const images = [heroImage?.url, metaImage?.url].filter((url): url is string => Boolean(url))

  const articleJsonLd = buildArticleJsonLd(
    {
      excerpt: post.excerpt,
      images,
      meta: post.meta,
      publishedAt: post.publishedAt,
      slug: post.slug,
      title: post.title,
      updatedAt: post.updatedAt,
    },
    base,
  )

  const breadcrumbJsonLd = buildPostBreadcrumbJsonLd(post, base)

  const relatedPosts = await queryRelatedPosts({ excludeId: post.id })
  const published = formatPostDate(post.publishedAt)

  return (
    <div className="bg-brand-50">
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <article className="container-editorial py-12 lg:py-16">
        <Link
          className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium uppercase tracking-wider text-gray-600 transition-colors hover:text-brand"
          href="/blog"
        >
          <ChevronLeftIcon className="size-4" />
          Späť na blog
        </Link>

        <header className="mt-8 max-w-[760px]">
          {published ? (
            <time
              className="font-tech text-[11px] uppercase tracking-[0.18em] text-gray-500"
              dateTime={post.publishedAt ?? undefined}
            >
              {published}
            </time>
          ) : null}

          <h1 className="section-h2 mt-4">{post.title}</h1>
          <div className="section-decorator mt-6" />

          {post.excerpt ? (
            <p className="mt-6 text-[16px] leading-[1.8] text-gray-700">{post.excerpt}</p>
          ) : null}
        </header>

        {heroImage ? (
          <div className="mt-10 overflow-hidden rounded-default bg-brand-100">
            <Media
              className="w-full"
              imgClassName="w-full h-auto object-cover"
              priority
              resource={heroImage}
            />
          </div>
        ) : null}

        {post.content ? (
          <RichText
            className="mt-12 max-w-[760px] prose-headings:font-display prose-headings:font-medium prose-a:text-brand"
            data={post.content}
            enableGutter={false}
          />
        ) : null}
      </article>

      {relatedPosts.length > 0 ? (
        <section className="container-editorial pb-16 lg:pb-24">
          <div className="border-t border-gray-200 pt-12">
            <p className="eyebrow">Ďalšie čítanie</p>
            <h2 className="section-h2 mt-4 text-[28px] sm:text-[32px]">Ďalšie články</h2>
            <div className="section-decorator mt-5" />

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((related) => (
                <PostCard key={related.id} post={related} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
