import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { getServerSideURL } from '@/utilities/getURL'

import { ShareWishlistButton } from './ShareWishlistButton'
import { WishlistGrid } from './WishlistGrid'

/**
 * `/wishlist` — „Obľúbené" (Z10).
 *
 * Customers only: the wishlist lives on the user document, so a guest is sent
 * to `/login?warning=…` exactly the way the account screens do it. The grid
 * itself is client-rendered off `WishlistProvider` so that un-hearting a card
 * updates the page immediately.
 *
 * Shell is the editorial one shared with `/blog` and the shop listing: cream
 * ground, kicker → displejový nadpis → tenká linka.
 *
 * `noindex`: the content differs for every visitor and is empty for a crawler.
 */

const DESCRIPTION =
  'Kúsky, ktoré ste si uložili srdiečkom — ručne pletené deky, hračky a prútené dekorácie na jednom mieste.'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: {
    canonical: `${getServerSideURL().replace(/\/$/, '')}/wishlist`,
  },
  description: DESCRIPTION,
  robots: { follow: true, index: false },
  title: 'Obľúbené',
}

export default async function WishlistPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k obľúbeným produktom.')}`,
    )
  }

  return (
    <div className="bg-brand-50">
      <div className="container-editorial py-12 lg:py-16">
        <p className="eyebrow">Vaša schránka</p>
        <h1 className="section-h2 mt-4">Obľúbené</h1>
        <div className="section-decorator mt-6" />

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-[560px] text-[15px] leading-[1.75] text-gray-700">{DESCRIPTION}</p>
          <ShareWishlistButton />
        </div>

        <WishlistGrid />
      </div>
    </div>
  )
}
