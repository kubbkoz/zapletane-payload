/**
 * Turning a verified provider profile into a `users` document.
 *
 * Three outcomes, in this order:
 *
 *   1. **Known identity** — a row already carries this exact
 *      `oauthProvider` + `oauthSub`. Log it in. The e-mail on the row is left
 *      alone: the provider's `sub` is the identity, the address is only a
 *      label, and silently rewriting it would let a provider-side address
 *      change move a ZAPLETANE account onto an address the shop never verified.
 *
 *   2. **Existing e-mail account** — no identity match, but an account exists
 *      with the same address. It is linked *only* if the provider asserts the
 *      address as verified (Google: the `email_verified` claim; Facebook:
 *      Graph omits unconfirmed addresses entirely, so presence is the
 *      assertion). Without that assertion this is refused outright — anyone can
 *      type any address into an unverified provider account, and accepting it
 *      would be a one-click takeover of the matching shop account.
 *
 *   3. **New shopper** — nothing matches, so a fresh customer row is created,
 *      carrying the identity from the start.
 */

import type { Payload } from 'payload'

import type { User } from '@/payload-types'

import { randomBytes } from 'crypto'

import type { OAuthProfile, OAuthProvider } from './providers'

export type ResolveOAuthUserResult =
  | { ok: false; reason: 'unverifiedEmail' }
  | { ok: true; user: User }

/** Payload lower-cases e-mails on login, so every lookup and write matches that. */
const normaliseEmail = (email: string): string => email.toLowerCase().trim()

/**
 * Auth collections require a credential at creation time. OAuth accounts get a
 * 48-byte random one that is never shown, never sent anywhere and never
 * reusable — the shopper signs in through the provider, or through "Zabudli ste
 * heslo?" if they later want an e-mail login too.
 */
const unusableCredential = (): string => randomBytes(48).toString('base64url')

export const resolveOAuthUser = async ({
  payload,
  profile,
  provider,
}: {
  payload: Payload
  profile: OAuthProfile
  provider: OAuthProvider
}): Promise<ResolveOAuthUserResult> => {
  const email = normaliseEmail(profile.email)

  // 1. Identity we have seen before.
  const byIdentity = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [{ oauthProvider: { equals: provider } }, { oauthSub: { equals: profile.sub } }],
    },
  })

  const existingIdentity = byIdentity.docs[0]

  if (existingIdentity) {
    return { ok: true, user: existingIdentity }
  }

  // Everything past this point needs an address to work with. Facebook can
  // legitimately return none (the shopper declined the `email` permission);
  // the caller renders that as its own Slovak message.
  if (!email) {
    return { ok: false, reason: 'unverifiedEmail' }
  }

  // 2. Same address, no identity yet.
  const byEmail = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { email: { equals: email } },
  })

  const existingByEmail = byEmail.docs[0]

  if (existingByEmail) {
    if (!profile.emailVerified) {
      return { ok: false, reason: 'unverifiedEmail' }
    }

    // Only claim the link slot when it is free (or already ours). If the
    // account is linked to the *other* provider, that link stays: the shopper
    // is still let in — they demonstrably control the verified address — but
    // their existing provider login is not quietly replaced.
    const linkIsFree = !existingByEmail.oauthSub || existingByEmail.oauthProvider === provider

    if (!linkIsFree) {
      return { ok: true, user: existingByEmail }
    }

    const linked = await payload.update({
      collection: 'users',
      id: existingByEmail.id,
      data: {
        oauthProvider: provider,
        oauthSub: profile.sub,
      },
      depth: 0,
      overrideAccess: true,
    })

    return { ok: true, user: linked }
  }

  // 3. Brand new shopper. An unverified address is still fine here: no existing
  // account can be taken over by creating one, and the address is only ever
  // used to reach this same person back.
  try {
    const created = await payload.create({
      collection: 'users',
      data: {
        name: profile.name || email.split('@')[0] || '',
        email,
        oauthProvider: provider,
        oauthSub: profile.sub,
        password: unusableCredential(),
        roles: ['customer'],
      },
      depth: 0,
      overrideAccess: true,
    })

    return { ok: true, user: created }
  } catch (error) {
    // Two callbacks for the same brand-new address can race; the loser trips
    // the unique e-mail index. Re-read instead of failing the login.
    const raced = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { email: { equals: email } },
    })

    const winner = raced.docs[0]

    if (winner) {
      return { ok: true, user: winner }
    }

    throw error
  }
}
