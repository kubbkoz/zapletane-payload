'use client'

import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { useAuth } from '@/providers/Auth'
import { useWishlist } from '@/wishlist/WishlistProvider'
import { Heart, User } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { HamburgerButton } from './Hamburger'

type Props = {
  isMobileMenuOpen: boolean
  onToggleMobileMenu: () => void
}

/**
 * Right-hand icon cluster of the main header row — port of
 * `app/components/layout/navbar/NavIcons.vue` (DESIGN-SPEC.md §2.1).
 *
 * All icons are `text-black hover:text-brand` on a transparent background (no
 * dark chips). The cart keeps this repo's existing Sheet wiring untouched —
 * `<Cart />` renders its own trigger and owns the commerce state; only its
 * placement in the bar is ours.
 *
 * Z10: the desktop magnifier is gone from this cluster — the `SearchBar` sits
 * two elements to the left and is the search entry point from `md` up, so the
 * icon was a second trigger for a field already on screen. Its slot now holds
 * the wishlist heart (`/wishlist`), with the same count badge recipe as the
 * cart.
 */
export function NavIcons({ isMobileMenuOpen, onToggleMobileMenu }: Props) {
  const { user } = useAuth()
  const wishlist = useWishlist()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const wishlistCount = wishlist?.count ?? 0

  return (
    <div className="z-50 flex items-center space-x-3 text-black">
      {/* Always the same markup (an anchor to /wishlist) so SSR and hydration
          agree; for a guest the navigation is cancelled and the "Prihláste sa"
          modal opens instead. `/wishlist` itself redirects a guest to /login
          anyway, so a middle-click or a copied link still lands somewhere sane. */}
      <Link
        aria-label={
          wishlistCount ? `Obľúbené — ${wishlistCount} položiek` : 'Obľúbené'
        }
        className="hidden rounded-sm bg-transparent p-2 text-black transition-colors duration-200 hover:text-brand focus:outline-none lg:flex"
        href="/wishlist"
        onClick={(event) => {
          if (wishlist && wishlist.isReady && !wishlist.isAuthenticated) {
            event.preventDefault()
            wishlist.promptLogin()
          }
        }}
      >
        <span className="relative flex items-center justify-center">
          <Heart className="h-6 w-6" strokeWidth={1.75} />
          {wishlistCount ? (
            <span className="absolute -right-2.5 -top-2.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-[3px] text-[9px] font-bold leading-none text-white ring-2 ring-brand-50">
              {wishlistCount > 99 ? '99+' : wishlistCount}
            </span>
          ) : null}
        </span>
      </Link>

      <Link
        aria-label="Môj účet"
        className="hidden items-center rounded-sm bg-transparent p-2 text-black transition-colors hover:text-brand md:flex"
        href={user ? '/account' : '/login'}
      >
        <User className="h-6 w-6" />
        {firstName ? (
          <span className="ml-2 hidden text-xs font-bold uppercase xl:block">{firstName}</span>
        ) : null}
      </Link>

      {/* Below `md` the bar is logo + hamburger only — the cart lives in the
          fixed bottom bar there (the drawer itself is still mounted here and
          portals to <body>, so the bottom bar can open this very sheet). */}
      <div className="hidden items-center md:flex">
        <Suspense fallback={<OpenCartButton />}>
          <Cart />
        </Suspense>
      </div>

      <HamburgerButton isOpen={isMobileMenuOpen} onClick={onToggleMobileMenu} />
    </div>
  )
}
