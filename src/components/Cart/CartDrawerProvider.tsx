'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'

type CartDrawerValue = {
  close: () => void
  isOpen: boolean
  open: () => void
  setOpen: (open: boolean) => void
}

const CartDrawerContext = createContext<CartDrawerValue | null>(null)

/**
 * One cart drawer, many triggers.
 *
 * The drawer itself is rendered by `CartModal` inside the header's icon
 * cluster, but on mobile that cluster is hidden — the cart is opened from the
 * fixed bottom bar, which lives in a completely different branch of the layout
 * tree. Rather than mounting a second `Sheet` (two portals, two copies of the
 * item list, two sources of truth for "is the cart open"), the open state is
 * lifted here and both places read it.
 *
 * `CartModal` degrades gracefully: with no provider above it, it keeps its own
 * local state exactly as before, so it stays usable in isolation (Storybook,
 * tests, any tree that does not mount this provider).
 */
export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false)

  const value = useMemo<CartDrawerValue>(
    () => ({
      close: () => setOpen(false),
      isOpen,
      open: () => setOpen(true),
      setOpen,
    }),
    [isOpen],
  )

  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>
}

/** `null` when no provider is mounted — callers must handle that. */
export function useCartDrawer(): CartDrawerValue | null {
  return useContext(CartDrawerContext)
}
