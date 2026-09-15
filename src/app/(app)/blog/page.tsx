import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { NotebookPen } from 'lucide-react'

import { Pager } from '@/components/Pager'
import { getServerSideURL } from '@/utilities/getURL'

import { PostCard } from './PostCard'

/**
 * `/blog` — výpis článkov (Z7).
 *
 * Shell je zhodný s výpisom obchodu (`shop/layout.tsx`): krémový podklad,
 * editoriálny kontajner, kicker → displejový nadpis → tenká linka. Karty sú
 * `PostCard`, teda tá istá anatómia ako produktová karta.
 *
 * Zobrazujú sa iba publikované články, najnovší hore. Pri viac než dvanástich
 * sa objaví stránkovanie — tie isté odkazy ako v obchode, len so základnou
 * cestou `/blog`, takže návštevník neodíde z kanonickej adresy.
 */

const PER_PAGE = 12

const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'

const DESCRIPTION =
  'Ako vznikajú ručne pletené deky, hračky a prútené dekorácie — návody, príbehy a pohľady do dielne ZAPLETANE.'

export const metadata: Metadata = {
  alternates: {
    canonical: `${getServerSideURL().replace(/\/$/, '')}/blog`,
  },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    locale: 'sk_SK',
    siteName: SITE_NAME,
    title: `Blog | ${SITE_NAME}`,
    type: 'website',
    url: `${getServerSideURL().replace(/\/$/, '')}/blog`,
  },
  title: 'Blog',
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const parsePage = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

/**
 * Publikované články pre jednu stranu výpisu. Nikdy nehádže: prázdna alebo
 * nedostupná databáza sa prejaví prázdnym stavom, nie chybovou stránkou.
 */
const queryPosts = async (page: number) => {
  try {
    const payload = await getPayload({ config: configPromise })

    return await payload.find({
      collection: 'posts',
      depth: 1,
      draft: false,
      limit: PER_PAGE,
      overrideAccess: false,
      page,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        heroImage: true,
        publishedAt: true,
      },
      sort: '-publishedAt',
      where: { _status: { equals: 'published' } },
    })
  } catch {
    return null
  }
}

export default async function BlogPage({ searchParams }: Props) {
  const rawSearchParams = await searchParams
  const page = parsePage(rawSearchParams.page)

  const posts = await queryPosts(page)

  const docs = posts?.docs ?? []

  return (
    <div className="bg-brand-50">
      <div className="container-editorial py-12 lg:py-16">
        <p className="eyebrow">Z našej dielne</p>
        <h1 className="section-h2 mt-4">Blog</h1>
        <div className="section-decorator mt-6" />
        <p className="mt-6 max-w-[560px] text-[15px] leading-[1.75] text-gray-700">{DESCRIPTION}</p>

        {docs.length > 0 ? (
          <>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            <Pager
              basePath="/blog"
              currentPage={page}
              searchParams={rawSearchParams}
              totalPages={posts?.totalPages ?? 1}
            />
          </>
        ) : (
          <div className="card-editorial mt-12 flex flex-col items-center px-8 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
              <NotebookPen className="size-7" strokeWidth={1.5} />
            </span>
            <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
              Zatiaľ tu nič nie je
            </h2>
            <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
              Prvý článok pripravujeme. Onedlho sa tu dozviete, ako jednotlivé kúsky vznikajú.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
