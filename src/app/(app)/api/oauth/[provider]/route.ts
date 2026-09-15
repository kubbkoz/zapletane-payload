import { getSafeRedirect } from 'payload/shared'

import { buildAuthorizationURL, isOAuthProvider, oauthProviderLabel } from '@/auth/oauth/providers'
import { createOAuthState, oauthStateCookie } from '@/auth/oauth/state'

export const dynamic = 'force-dynamic'

/**
 * GET /api/oauth/google   |   GET /api/oauth/facebook
 *
 * Step one of the authorization-code flow: mint the anti-CSRF `state`, drop it
 * in an httpOnly cookie, and bounce the browser to the provider.
 *
 * Route handlers are outside the pre-launch gate by construction — the gate is
 * a decision made in the `(app)` layout, which never runs for a route handler,
 * and `src/middleware.ts` excludes `/api` from its matcher — so a shopper with
 * the site still gated can complete a login.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params
  const url = new URL(request.url)

  const failure = (message: string) =>
    Response.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin), 302)

  if (!isOAuthProvider(provider)) {
    return failure('Neznámy spôsob prihlásenia.')
  }

  // Same-origin paths only. `getSafeRedirect` is Payload's own guard (see
  // node_modules/payload/dist/utilities/getSafeRedirect.js): it rejects absolute
  // URLs, protocol-relative `//host`, encoded-slash and backslash tricks,
  // `javascript:` and control characters, falling back to `/account`.
  const redirect = getSafeRedirect({
    fallbackTo: '/account',
    redirectTo: url.searchParams.get('redirect') ?? '',
  })

  const state = createOAuthState({ provider, redirect })
  const authorizationURL = buildAuthorizationURL({ provider, state })

  if (!authorizationURL) {
    // Credentials missing — the buttons are hidden in this case, so this is
    // either a hand-typed URL or a half-configured deployment.
    return failure(`Prihlásenie cez ${oauthProviderLabel(provider)} nie je momentálne dostupné.`)
  }

  const headers = new Headers({ Location: authorizationURL })
  headers.append('Set-Cookie', oauthStateCookie({ secure: url.protocol === 'https:', value: state }))

  return new Response(null, { headers, status: 302 })
}
