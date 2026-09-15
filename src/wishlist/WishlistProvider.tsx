'use client'

import type { User } from '@/payload-types'

import { useAuth } from '@/providers/Auth'
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { WishlistLoginDialog } from './WishlistLoginDialog'

export type WishlistValue = {
  /** How many products are saved — drives the navbar badge and the account card. */
  count: number
  has: (id: number) => boolean
  ids: number[]
  /** A user document is present, so hearts actually persist. */
  isAuthenticated: boolean
  /**
   * `false` until `/api/users/me` has answered. Consumers render the neutral
   * outline state until then, so SSR and the first client paint agree.
   */
  isReady: boolean
  /** Opens the "Prihláste sa" modal. Used by every guest-facing heart. */
  promptLogin: () => void
  /**
   * Returns the share token for this account, minting and persisting one on
   * first use. `null` for a guest or when the write failed.
   */
  resolveShareToken: () => Promise<null | string>
  /** Toggling as a guest never writes anything — it opens the login modal. */
  toggle: (id: number) => void
}

const WishlistContext = createContext<null | WishlistValue>(null)

/**
 * `user.wishlist` arrives either as plain ids (depth 0) or as populated
 * product docs (depth ≥ 1), depending on which endpoint filled it in.
 */
function toIds(wishlist: User['wishlist']): number[] {
  if (!Array.isArray(wishlist)) return []

  return wishlist
    .map((entry) => (typeof entry === 'object' && entry ? entry.id : entry))
    .filter((id): id is number => typeof id === 'number')
}

/** `crypto.randomUUID` is unavailable on insecure non-localhost origins. */
function mintToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Obľúbené — the wishlist (Z10).
 *
 * **Customers only.** The single source of truth is the `wishlist`
 * relationship on the user document, written through `PATCH /api/users/:id`
 * with `credentials: 'include'` — exactly the path `AccountForm` already uses.
 * Payload's `users.update` access is `adminOrSelf`, which resolves to
 * `{ id: { equals: user.id } }` for a customer, so that PATCH can only ever
 * reach the caller's own row.
 *
 * There is deliberately **no guest tier**: no localStorage, no merge-on-login.
 * A guest who taps a heart gets the "Prihláste sa" modal this provider mounts,
 * and nothing is stored anywhere until they have an account.
 *
 * Sharing works off `wishlistShareToken`, a random token minted on first use
 * and written through the same PATCH. The resulting `/wishlist/zdielane/<token>`
 * link is a **capability URL**: whoever holds it can read that list, so it is
 * treated as a secret, and the public page reads nothing but the saved products
 * — never a name or an e-mail.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  /** Pending optimistic list; `null` means "whatever the user document says". */
  const [optimistic, setOptimistic] = useState<null | number[]>(null)
  const [isPromptOpen, setPromptOpen] = useState(false)

  /** Token minted in this session before the refreshed user doc came back. */
  const [localToken, setLocalToken] = useState<null | string>(null)
  const inFlightToken = useRef<null | Promise<null | string>>(null)

  const serverIDs = useMemo(() => toIds(user?.wishlist), [user?.wishlist])
  const ids = optimistic ?? serverIDs

  const patchUser = useCallback(
    async (userID: number | string, data: Record<string, unknown>): Promise<boolean> => {
      try {
        // Same-origin relative path on purpose: this only ever runs in the
        // browser, and the session cookie is bound to the origin the page was
        // served from — an absolute NEXT_PUBLIC_SERVER_URL would send the
        // write cross-origin (and cookie-less) whenever the two disagree.
        const response = await fetch(`/api/users/${userID}`, {
          body: JSON.stringify(data),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        })

        return response.ok
      } catch {
        return false
      }
    },
    [],
  )

  const promptLogin = useCallback(() => setPromptOpen(true), [])

  const has = useCallback((id: number) => ids.includes(id), [ids])

  const toggle = useCallback(
    (id: number) => {
      if (!user) {
        promptLogin()
        return
      }

      if (!Number.isFinite(id)) return

      const current = ids
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]

      setOptimistic(next)

      void patchUser(user.id, { wishlist: next }).then((ok) => {
        // Roll back a failed write; a successful one stays optimistic until the
        // next `/me` refresh, which will agree with it anyway.
        if (!ok) setOptimistic(current)
      })
    },
    [ids, patchUser, promptLogin, user],
  )

  const resolveShareToken = useCallback(async (): Promise<null | string> => {
    if (!user) {
      promptLogin()
      return null
    }

    const existing = user.wishlistShareToken || localToken
    if (existing) return existing

    // Two clicks in a row must not mint two tokens.
    if (inFlightToken.current) return inFlightToken.current

    const token = mintToken()

    const request = patchUser(user.id, { wishlistShareToken: token }).then((ok) => {
      inFlightToken.current = null

      if (!ok) return null

      setLocalToken(token)
      return token
    })

    inFlightToken.current = request

    return request
  }, [localToken, patchUser, promptLogin, user])

  const value = useMemo<WishlistValue>(
    () => ({
      count: ids.length,
      has,
      ids,
      isAuthenticated: Boolean(user),
      isReady: typeof user !== 'undefined',
      promptLogin,
      resolveShareToken,
      toggle,
    }),
    [has, ids, promptLogin, resolveShareToken, toggle, user],
  )

  return (
    <WishlistContext.Provider value={value}>
      {children}
      <WishlistLoginDialog onOpenChange={setPromptOpen} open={isPromptOpen} />
    </WishlistContext.Provider>
  )
}

/**
 * `null` when no provider is mounted — every caller must handle that, the same
 * contract `useCartDrawer` uses, so the header and the card stay renderable in
 * isolation (tests, Storybook, any tree without the provider).
 */
export function useWishlist(): null | WishlistValue {
  return useContext(WishlistContext)
}
