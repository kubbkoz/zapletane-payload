/**
 * OAuth 2.0 provider registry — Google a Facebook.
 *
 * Everything provider-specific lives here: which env vars configure it, how the
 * authorization URL is built, how the code is exchanged, and how the provider's
 * profile response is normalised into the one shape the callback cares about
 * ({ sub, email, emailVerified, name }).
 *
 * Nothing in this module reads or writes the database and nothing here is a
 * client component — `GOOGLE_CLIENT_SECRET` / `FACEBOOK_APP_SECRET` are read at
 * call time on the server only. `isProviderConfigured()` is the *only* thing
 * the storefront is allowed to learn about them (a boolean, never a value).
 */

import { createHmac } from 'crypto'

import { getServerSideURL } from '@/utilities/getURL'

export const OAUTH_PROVIDERS = ['google', 'facebook'] as const

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

export const isOAuthProvider = (value: unknown): value is OAuthProvider =>
  typeof value === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(value)

/** Graph API version used for both the dialog and the `/me` lookup. */
const FACEBOOK_GRAPH_VERSION = 'v19.0'

/** Normalised identity, whatever the provider called its fields. */
export type OAuthProfile = {
  /**
   * Whether the *provider* asserts the address is verified. Account linking
   * (attaching this identity to an existing e-mail account) hinges on it —
   * see `resolveOAuthUser`.
   */
  emailVerified: boolean
  email: string
  name: null | string
  /** Stable, provider-scoped account id — Google `sub`, Facebook `id`. */
  sub: string
}

type ProviderDefinition = {
  /** Reads the credentials out of `process.env`; null when either half is missing. */
  credentials: () => null | { clientId: string; clientSecret: string }
  /** Scopes requested in the authorization request. */
  scope: string
  /** Extra query params on the authorization URL (prompt, response_type…). */
  authorizationParams: Record<string, string>
  authorizationEndpoint: string
  exchange: (args: {
    code: string
    credentials: { clientId: string; clientSecret: string }
    redirectURI: string
  }) => Promise<string>
  fetchProfile: (args: {
    accessToken: string
    credentials: { clientId: string; clientSecret: string }
  }) => Promise<OAuthProfile>
  label: string
}

/** Trims and drops empties so `GOOGLE_CLIENT_ID=` (placeholder) counts as unset. */
const env = (name: string): string => (process.env[name] || '').trim()

const readCredentials =
  (idVar: string, secretVar: string) => (): null | { clientId: string; clientSecret: string } => {
    const clientId = env(idVar)
    const clientSecret = env(secretVar)

    if (!clientId || !clientSecret) return null

    return { clientId, clientSecret }
  }

class OAuthError extends Error {}

/**
 * `email_verified` comes back as a real boolean from Google's OIDC userinfo
 * endpoint, but the spec allows the string form too, so accept both and treat
 * anything else as "not verified".
 */
const asVerified = (value: unknown): boolean => value === true || value === 'true'

const definitions: Record<OAuthProvider, ProviderDefinition> = {
  facebook: {
    authorizationEndpoint: `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`,
    authorizationParams: {
      auth_type: 'rerequest',
      response_type: 'code',
    },
    credentials: readCredentials('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'),
    label: 'Facebook',
    scope: 'email',
    async exchange({ code, credentials, redirectURI }) {
      // Facebook documents this exchange as a GET with the parameters in the
      // query string. It is a server-to-server call over TLS (the secret never
      // reaches a browser, a Referer header or a redirect), so it follows the
      // documented shape rather than guessing at POST support.
      const url = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`)
      url.searchParams.set('client_id', credentials.clientId)
      url.searchParams.set('client_secret', credentials.clientSecret)
      url.searchParams.set('redirect_uri', redirectURI)
      url.searchParams.set('code', code)

      const response = await fetch(url, { headers: { Accept: 'application/json' } })

      if (!response.ok) {
        throw new OAuthError(`Facebook token exchange failed with status ${response.status}`)
      }

      const body = (await response.json()) as { access_token?: unknown }

      if (typeof body.access_token !== 'string' || !body.access_token) {
        throw new OAuthError('Facebook token exchange returned no access token')
      }

      return body.access_token
    },
    async fetchProfile({ accessToken, credentials }) {
      const url = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`)
      url.searchParams.set('fields', 'id,name,email')
      // Proof-of-secret for server-side Graph calls: harmless when the app does
      // not require it, mandatory once "Require app secret proof" is switched on
      // in the app settings.
      url.searchParams.set(
        'appsecret_proof',
        createHmac('sha256', credentials.clientSecret).update(accessToken).digest('hex'),
      )

      const response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        throw new OAuthError(`Facebook profile request failed with status ${response.status}`)
      }

      const body = (await response.json()) as {
        email?: unknown
        id?: unknown
        name?: unknown
      }

      if (typeof body.id !== 'string' || !body.id) {
        throw new OAuthError('Facebook profile response has no id')
      }

      return {
        email: typeof body.email === 'string' ? body.email : '',
        // Graph only ever returns a confirmed address on `/me?fields=email`;
        // an unconfirmed one is omitted entirely. So presence *is* the
        // verification signal, and the empty case is handled by the caller as
        // "no e-mail permission".
        emailVerified: typeof body.email === 'string' && body.email.length > 0,
        name: typeof body.name === 'string' ? body.name : null,
        sub: body.id,
      }
    },
  },
  google: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    authorizationParams: {
      // No refresh token is wanted: this is a login, not an API integration.
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'select_account',
      response_type: 'code',
    },
    credentials: readCredentials('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    label: 'Google',
    scope: 'openid email profile',
    async exchange({ code, credentials, redirectURI }) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectURI,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      })

      if (!response.ok) {
        throw new OAuthError(`Google token exchange failed with status ${response.status}`)
      }

      const body = (await response.json()) as { access_token?: unknown }

      if (typeof body.access_token !== 'string' || !body.access_token) {
        throw new OAuthError('Google token exchange returned no access token')
      }

      return body.access_token
    },
    async fetchProfile({ accessToken }) {
      // The OIDC userinfo endpoint rather than decoding the id_token: this is a
      // direct, authenticated server-to-server read, so the claims need no
      // signature verification of our own to be trustworthy.
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        throw new OAuthError(`Google profile request failed with status ${response.status}`)
      }

      const body = (await response.json()) as {
        email?: unknown
        email_verified?: unknown
        name?: unknown
        sub?: unknown
      }

      if (typeof body.sub !== 'string' || !body.sub) {
        throw new OAuthError('Google profile response has no sub')
      }

      return {
        email: typeof body.email === 'string' ? body.email : '',
        emailVerified: asVerified(body.email_verified),
        name: typeof body.name === 'string' ? body.name : null,
        sub: body.sub,
      }
    },
  },
}

/** Human-readable provider name for Slovak copy ("Prihlásenie cez Google…"). */
export const oauthProviderLabel = (provider: OAuthProvider): string =>
  definitions[provider].label

/**
 * The redirect URI registered in the Google / Meta console. Built from
 * NEXT_PUBLIC_SERVER_URL so the value the provider is told matches the value
 * sent again at token-exchange time (both providers compare them byte for byte).
 */
export const oauthRedirectURI = (provider: OAuthProvider): string =>
  `${getServerSideURL().replace(/\/$/, '')}/api/oauth/${provider}/callback`

/**
 * Server-only: is this provider usable at all? The storefront calls this in a
 * server component and passes the *boolean* to the client — the credentials
 * themselves never cross that boundary.
 */
export const isProviderConfigured = (provider: OAuthProvider): boolean =>
  definitions[provider].credentials() !== null

/** `{ google: boolean, facebook: boolean }` for gating the login/registration buttons. */
export const configuredOAuthProviders = (): Record<OAuthProvider, boolean> =>
  Object.fromEntries(OAUTH_PROVIDERS.map((p) => [p, isProviderConfigured(p)])) as Record<
    OAuthProvider,
    boolean
  >

/** Full authorization URL for the 302 that starts the flow. Null when unconfigured. */
export const buildAuthorizationURL = ({
  provider,
  state,
}: {
  provider: OAuthProvider
  state: string
}): null | string => {
  const definition = definitions[provider]
  const credentials = definition.credentials()

  if (!credentials) return null

  const url = new URL(definition.authorizationEndpoint)
  url.searchParams.set('client_id', credentials.clientId)
  url.searchParams.set('redirect_uri', oauthRedirectURI(provider))
  url.searchParams.set('scope', definition.scope)
  url.searchParams.set('state', state)

  for (const [key, value] of Object.entries(definition.authorizationParams)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

/**
 * Code → access token → normalised profile. Throws on any provider-side
 * failure; the caller turns that into a Slovak error redirect and never
 * surfaces the underlying message (it can carry request identifiers).
 */
export const exchangeCodeForProfile = async ({
  code,
  provider,
}: {
  code: string
  provider: OAuthProvider
}): Promise<OAuthProfile> => {
  const definition = definitions[provider]
  const credentials = definition.credentials()

  if (!credentials) {
    throw new OAuthError(`Provider ${provider} is not configured`)
  }

  const accessToken = await definition.exchange({
    code,
    credentials,
    redirectURI: oauthRedirectURI(provider),
  })

  return definition.fetchProfile({ accessToken, credentials })
}
