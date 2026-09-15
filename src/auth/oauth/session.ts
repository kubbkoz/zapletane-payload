/**
 * Minting a real Payload session from a route handler.
 *
 * `payload.login()` is the supported programmatic way in, but it insists on a
 * password (`loginOperation` in node_modules/payload/dist/auth/operations/login.js
 * throws `ValidationError` on an empty one and then bcrypt-compares it), and an
 * OAuth callback has no password to give — by design, the account's stored one
 * is random and unusable.
 *
 * So this reproduces the *tail* of that operation, calling the very same
 * exported helpers it calls, in the same order:
 *
 *   1. `payload.db.findOne`     — the raw row, including the `sessions` array
 *                                 (a `hidden`/`admin.disabled` field the Local
 *                                 API would strip, which would silently wipe
 *                                 the user's other sessions on write).
 *   2. `addSessionToUser`       — payload/shared; appends `{ id, createdAt,
 *                                 expiresAt }`, drops expired ones, persists.
 *                                 Not optional: `auth.useSessions` defaults to
 *                                 true (collections/config/defaults.js), and
 *                                 the JWT strategy
 *                                 (auth/strategies/jwt.js) rejects any token
 *                                 whose `sid` is not in that array.
 *   3. `getFieldsToSign`        — payload; `{ id, collection, email, sid }`
 *                                 plus any `saveToJWT` fields.
 *   4. `jwtSign`                — payload; HS256 over `payload.secret`, with
 *                                 the collection's own `tokenExpiration`.
 *   5. `generatePayloadCookie`  — payload/shared; the identical `payload-token`
 *                                 cookie the REST login handler
 *                                 (auth/endpoints/login.js) sets — same name
 *                                 from `config.cookiePrefix`, same httpOnly /
 *                                 path / sameSite / secure / expiry.
 *
 * The result is indistinguishable from an e-mail login: `payload.auth()`,
 * `/api/users/me`, logout and the existing session list all treat it the same.
 */

import type { Payload, TypedUser, TypeWithID } from 'payload'

import { createLocalReq, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

/**
 * Builds the `Set-Cookie` value that logs `userID` in.
 *
 * Note on hooks: `loginOperation` also fires the collection's `beforeLogin` /
 * `afterLogin` hooks. `users` defines neither, so they are deliberately not
 * replayed here — add them here too if any are ever introduced.
 */
export const mintPayloadSessionCookie = async ({
  payload,
  userID,
}: {
  payload: Payload
  userID: number | string
}): Promise<string> => {
  const collection = payload.collections['users']

  if (!collection) {
    throw new Error('The `users` collection is not registered.')
  }

  const collectionConfig = collection.config
  const req = await createLocalReq({}, payload)

  const user = await payload.db.findOne<TypeWithID & Record<string, unknown>>({
    collection: collectionConfig.slug,
    req,
    where: { id: { equals: userID } },
  })

  if (!user) {
    throw new Error('Cannot mint a session for a user that no longer exists.')
  }

  // Mirrors loginOperation: the authenticated principal carries its collection
  // and the strategy that produced it.
  user.collection = collectionConfig.slug
  user._strategy = 'local-jwt'

  const { sid } = await addSessionToUser({
    collectionConfig,
    payload,
    req,
    user: user as unknown as TypedUser,
  })

  const fieldsToSign = getFieldsToSign({
    collectionConfig,
    email: typeof user.email === 'string' ? user.email : '',
    sid,
    user: user as unknown as TypedUser,
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })

  return generatePayloadCookie({
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  })
}
