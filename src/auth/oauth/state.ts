/**
 * Anti-CSRF `state` for the OAuth code flow.
 *
 * One value plays two roles:
 *   - it travels to the provider as `?state=…` and comes back on the callback,
 *   - it is stored, at the same instant, in an httpOnly cookie scoped to
 *     `/api/oauth`.
 *
 * A callback is only accepted when the two match (timing-safe), so a third
 * party cannot make a browser complete a flow it never started: they can put
 * any `state` in the URL, but they cannot write that cookie.
 *
 * The value is additionally HMAC-signed with PAYLOAD_SECRET. The signature is
 * not what stops CSRF (the cookie is) — it protects the payload *inside* the
 * state, which carries the post-login redirect target and the provider name, so
 * neither can be swapped for something else on the way back.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

import type { OAuthProvider } from './providers'

import { isOAuthProvider } from './providers'

/** Cookie holding the copy of `state` the callback must match. */
export const OAUTH_STATE_COOKIE = 'zap_oauth_state'

/** Only ever sent to the two OAuth route handlers, never with page requests. */
export const OAUTH_COOKIE_PATH = '/api/oauth'

/** Short window: a login redirect that has not come back in 10 minutes is dead. */
export const OAUTH_STATE_MAX_AGE_SECONDS = 600

/** `Set-Cookie` that plants the state for one flow. */
export const oauthStateCookie = ({ secure, value }: { secure: boolean; value: string }): string =>
  [
    `${OAUTH_STATE_COOKIE}=${value}`,
    `Path=${OAUTH_COOKIE_PATH}`,
    `Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')

/**
 * `Set-Cookie` that burns it. Written out rather than built with Payload's
 * `generateCookie`, whose `maxAge` is emitted only when truthy — `Max-Age=0`
 * would silently vanish and leave the state cookie replayable.
 */
export const expiredOAuthStateCookie = ({ secure }: { secure: boolean }): string =>
  [
    `${OAUTH_STATE_COOKIE}=`,
    `Path=${OAUTH_COOKIE_PATH}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')

type StatePayload = {
  /** Random 32 bytes — the actual unguessable part. */
  n: string
  /** Provider the flow was started for. */
  p: OAuthProvider
  /** Same-origin path to land on afterwards. */
  r: string
  /** Issued-at, seconds since epoch. */
  t: number
}

export type VerifiedState = {
  provider: OAuthProvider
  redirect: string
}

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url')

const sign = (payload: string): string =>
  createHmac('sha256', process.env.PAYLOAD_SECRET || '').update(payload).digest('base64url')

/** Constant-time string compare that never throws on a length mismatch. */
export const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) {
    // Still burn a comparison so the "wrong length" branch is not measurably
    // faster than the "right length, wrong bytes" one.
    timingSafeEqual(bufferA, bufferA)
    return false
  }

  return timingSafeEqual(bufferA, bufferB)
}

/** Mints `<base64url(json)>.<hmac>` for one flow. */
export const createOAuthState = ({
  provider,
  redirect,
}: {
  provider: OAuthProvider
  redirect: string
}): string => {
  const payload: StatePayload = {
    n: randomBytes(32).toString('base64url'),
    p: provider,
    r: redirect,
    t: Math.floor(Date.now() / 1000),
  }

  const encoded = base64url(JSON.stringify(payload))

  return `${encoded}.${sign(encoded)}`
}

/**
 * Validates the returned `state` against the cookie copy and unpacks it.
 * Returns null on anything at all suspicious — wrong signature, expired,
 * different provider, or the two copies not being identical.
 */
export const verifyOAuthState = ({
  cookieValue,
  provider,
  stateParam,
}: {
  cookieValue: null | string | undefined
  provider: OAuthProvider
  stateParam: null | string | undefined
}): null | VerifiedState => {
  if (!cookieValue || !stateParam) return null
  if (!safeEqual(stateParam, cookieValue)) return null

  const separator = stateParam.lastIndexOf('.')
  if (separator <= 0) return null

  const encoded = stateParam.slice(0, separator)
  const signature = stateParam.slice(separator + 1)

  if (!safeEqual(signature, sign(encoded))) return null

  let payload: StatePayload

  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object') return null
  if (!isOAuthProvider(payload.p) || payload.p !== provider) return null
  if (typeof payload.n !== 'string' || payload.n.length < 32) return null
  if (typeof payload.t !== 'number' || !Number.isFinite(payload.t)) return null

  const ageSeconds = Math.floor(Date.now() / 1000) - payload.t

  if (ageSeconds < 0 || ageSeconds > OAUTH_STATE_MAX_AGE_SECONDS) return null

  return {
    provider: payload.p,
    redirect: typeof payload.r === 'string' ? payload.r : '/account',
  }
}
