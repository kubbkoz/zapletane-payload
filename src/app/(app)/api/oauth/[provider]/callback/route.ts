import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getSafeRedirect, parseCookies } from 'payload/shared'

import type { OAuthProvider } from '@/auth/oauth/providers'

import { exchangeCodeForProfile, isOAuthProvider, oauthProviderLabel } from '@/auth/oauth/providers'
import { mintPayloadSessionCookie } from '@/auth/oauth/session'
import { expiredOAuthStateCookie, OAUTH_STATE_COOKIE, verifyOAuthState } from '@/auth/oauth/state'
import { resolveOAuthUser } from '@/auth/oauth/users'

export const dynamic = 'force-dynamic'

/**
 * GET /api/oauth/google/callback   |   GET /api/oauth/facebook/callback
 *
 * Step two: verify `state`, trade the code for a profile, find-or-create the
 * shopper, and set the same `payload-token` cookie an e-mail login would.
 *
 * Failure policy: every error ends as a 302 to /login with a Slovak message in
 * `?error=` (rendered by RenderParams). Nothing from the provider's own error
 * body is echoed back — those can carry request identifiers — and no token,
 * code or secret is ever logged.
 *
 * Responses are assembled from an explicit `Headers` object so that the two
 * `Set-Cookie` lines of the success path (the new session, the burnt state) are
 * both emitted, rather than relying on how two cookie APIs interleave.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: providerParam } = await params
  const url = new URL(request.url)
  const secure = url.protocol === 'https:'
  const burntState = expiredOAuthStateCookie({ secure })

  /** All failures land on /login, and always clear the one-shot state cookie. */
  const failure = (message: string): Response => {
    const headers = new Headers({
      Location: new URL(`/login?error=${encodeURIComponent(message)}`, url.origin).toString(),
    })
    headers.append('Set-Cookie', burntState)
    return new Response(null, { headers, status: 302 })
  }

  if (!isOAuthProvider(providerParam)) {
    return failure('Neznámy spôsob prihlásenia.')
  }

  const provider: OAuthProvider = providerParam
  const label = oauthProviderLabel(provider)

  // 1. Anti-CSRF: the returned `state` must equal the httpOnly copy, byte for
  //    byte, still be signed with our secret, name this same provider and be
  //    under 10 minutes old.
  const verified = verifyOAuthState({
    cookieValue: parseCookies(request.headers).get(OAUTH_STATE_COOKIE),
    provider,
    stateParam: url.searchParams.get('state'),
  })

  if (!verified) {
    return failure(
      `Prihlásenie cez ${label} sa nepodarilo overiť. Skúste to prosím znova z prihlasovacej stránky.`,
    )
  }

  // 2. The shopper pressed "Cancel" on the consent screen, or the provider
  //    refused — both arrive as `?error=`.
  if (url.searchParams.get('error')) {
    return failure(`Prihlásenie cez ${label} bolo zrušené.`)
  }

  const code = url.searchParams.get('code')

  if (!code) {
    return failure(`Prihlásenie cez ${label} sa nepodarilo. Skúste to prosím znova.`)
  }

  try {
    const profile = await exchangeCodeForProfile({ code, provider })
    const payload = await getPayload({ config: configPromise })

    const result = await resolveOAuthUser({ payload, profile, provider })

    if (!result.ok) {
      return failure(
        provider === 'facebook'
          ? 'Facebook nám neposkytol overenú e-mailovú adresu. Povoľte prosím zdieľanie e-mailu, alebo sa prihláste e-mailom a heslom.'
          : `Účet ${label} nemá overenú e-mailovú adresu, preto ho nemôžeme prepojiť s existujúcim účtom. Prihláste sa prosím e-mailom a heslom.`,
      )
    }

    const sessionCookie = await mintPayloadSessionCookie({ payload, userID: result.user.id })

    // Re-guard the redirect on the way out: it was signed into the state, but
    // signing only proves it is unchanged, not that it is safe.
    const destination = getSafeRedirect({ fallbackTo: '/account', redirectTo: verified.redirect })

    const headers = new Headers({
      Location: new URL(destination, url.origin).toString(),
    })
    // `sessionCookie` is a complete Set-Cookie value from Payload's own
    // `generatePayloadCookie`, so it is emitted verbatim rather than rebuilt.
    headers.append('Set-Cookie', sessionCookie)
    headers.append('Set-Cookie', burntState)

    return new Response(null, { headers, status: 302 })
  } catch (error) {
    // Message only — the error object can hold the provider's response body.
    console.error(
      `[oauth] ${provider} callback failed:`,
      error instanceof Error ? error.message : 'unknown error',
    )

    return failure(`Prihlásenie cez ${label} sa nepodarilo. Skúste to prosím znova.`)
  }
}
