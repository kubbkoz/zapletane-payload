import { NextResponse, type NextRequest } from 'next/server'

import {
  COMING_SOON_BYPASS_COOKIE,
  COMING_SOON_BYPASS_MAX_AGE,
  COMING_SOON_PREVIEW_PARAM,
} from '@/lib/comingSoon'

/**
 * Pre-launch bypass — the one half of the gate a React Server Component cannot
 * do itself.
 *
 * The gate decision (is the pre-launch page up?) lives in the (app) root
 * layout, where the Payload Local API is available. But the owner's way in —
 * `?preview=<secret>` sets a cookie and 302s the secret out of the URL — needs
 * to *write* a cookie and redirect, neither of which a layout can do. So that
 * single step happens here, with the exact param name, cookie name, lifetime
 * and redirect semantics of the Nuxt original
 * (`server/middleware/coming-soon.ts`).
 *
 * This runs on every storefront request, so it stays deliberately cheap: no DB,
 * no fetch — when `COMING_SOON_BYPASS` is unset, or the param is absent or
 * wrong, it falls straight through.
 */

export function middleware(request: NextRequest) {
  const secret = (process.env.COMING_SOON_BYPASS || '').trim()
  if (!secret) return NextResponse.next()

  const url = request.nextUrl
  if (url.searchParams.get(COMING_SOON_PREVIEW_PARAM) !== secret) return NextResponse.next()

  // Redirect so the secret does not stay in the address bar, in history, or in
  // any referrer header the storefront sends onward.
  const target = url.clone()
  target.searchParams.delete(COMING_SOON_PREVIEW_PARAM)

  const response = NextResponse.redirect(target, 302)

  response.cookies.set(COMING_SOON_BYPASS_COOKIE, secret, {
    httpOnly: true,
    maxAge: COMING_SOON_BYPASS_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: url.protocol === 'https:',
  })

  return response
}

/**
 * Everything the gate itself needs has to keep serving, same allowlist as the
 * original: the admin panel and Payload's API (`/admin`, `/api`), Next's own
 * assets, and the stable public paths the pre-launch page loads (its fonts,
 * the hero photo, the icons, the PWA manifest).
 */
export const config = {
  matcher: [
    '/((?!admin|api|_next|assets/|fonts/|payment-icons/|favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|manifest\\.webmanifest|sw\\.js|robots\\.txt).*)',
  ],
}
