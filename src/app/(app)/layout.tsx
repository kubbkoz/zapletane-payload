import type { Viewport } from 'next'
import type { ReactNode } from 'react'

import type { SiteSetting } from '@/payload-types'

import { AdminBar } from '@/components/AdminBar'
import { ComingSoonPage } from '@/components/ComingSoon'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { COMING_SOON_BYPASS_COOKIE } from '@/lib/comingSoon'
import { ensureStartsWith } from '@/utilities/ensureStartsWith'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-sans/800.css'
import '@fontsource-variable/unbounded'
import { cookies } from 'next/headers'
import React from 'react'
import './globals.css'

const { TWITTER_CREATOR, TWITTER_SITE } = process.env
const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'
const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const twitterCreator = TWITTER_CREATOR ? ensureStartsWith(TWITTER_CREATOR, '@') : undefined
const twitterSite = TWITTER_SITE ? ensureStartsWith(TWITTER_SITE, 'https://') : undefined

export const metadata = {
  metadataBase: new URL(baseUrl),
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  ...(twitterCreator &&
    twitterSite && {
      twitter: {
        card: 'summary_large_image',
        creator: twitterCreator,
        site: twitterSite,
      },
    }),
}

/**
 * `viewport-fit=cover` is load-bearing, not cosmetic: the `pb-safe` / `pt-safe`
 * utilities in globals.css resolve `env(safe-area-inset-*)` to 0 without it,
 * and the pre-launch page's own viewport meta carried it too.
 */
export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: 'cover',
  width: 'device-width',
}

/** The original's falsy set for `COMING_SOON` — everything else is truthy. */
const OFF = new Set(['', '0', 'false', 'off', 'no'])

/**
 * Is the pre-launch page up at all? Same source chain as the Nuxt original
 * (`server/utils/coming-soon-state.ts`), with the DB standing in for Nitro
 * storage:
 *
 *   1. the `site-settings` global — the only source a human can change without
 *      a deploy (admin UI or MCP). Anything but an explicit `false` counts as
 *      ON, so a database that has never had this global saved still launches
 *      gated.
 *   2. `COMING_SOON` — only consulted when the global could not be read at all
 *      (database down / not migrated yet), so a pre-launch site can still put
 *      the DB-free placeholder in front of a broken storefront.
 *   3. otherwise off, so a post-launch storefront never flashes the
 *      pre-launch page because of a transient database error.
 */
function isComingSoonEnabled(siteSettings: null | SiteSetting): boolean {
  if (siteSettings) return siteSettings.comingSoonEnabled !== false

  const fromEnv = process.env.COMING_SOON

  if (fromEnv !== undefined) return !OFF.has(fromEnv.trim().toLowerCase())

  return false
}

/**
 * ...and is it up for *this* visitor? `COMING_SOON_BYPASS` + the
 * `zapletane_preview` cookie (minted by `src/middleware.ts` from
 * `?preview=<secret>`) let the owner through while the gate stays up for
 * everyone else.
 *
 * Cookies are only read when the gate is actually enabled, so an ungated
 * storefront keeps whatever static rendering its routes are eligible for.
 */
async function isGated(comingSoonEnabled: boolean): Promise<boolean> {
  if (!comingSoonEnabled) return false

  const secret = (process.env.COMING_SOON_BYPASS || '').trim()
  if (!secret) return true

  const cookieStore = await cookies()

  return cookieStore.get(COMING_SOON_BYPASS_COOKIE)?.value !== secret
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const siteSettings = await getSiteSettings()

  if (await isGated(isComingSoonEnabled(siteSettings))) {
    // Returned *instead of* the storefront tree: `children` is never rendered,
    // so no page component, no commerce query and no provider ever runs behind
    // the pre-launch page. Payload's admin panel lives in the (payload) route
    // group and has its own root layout, so it is untouched by this.
    return (
      <ComingSoonPage
        copy={siteSettings?.comingSoon}
        email={siteSettings?.comingSoon?.email}
        phone={siteSettings?.comingSoon?.phone}
      />
    )
  }

  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        <InitTheme />
        <meta content="#FAF7F5" name="theme-color" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <link href="/manifest.webmanifest" rel="manifest" />
      </head>
      <body>
        <Providers>
          <AdminBar />
          <LivePreviewListener />

          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
