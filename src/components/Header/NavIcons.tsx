'use client'

import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { useAuth } from '@/providers/Auth'
import { Search, User } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { HamburgerButton } from './Hamburger'

type Props = {
  isMobileMenuOpen: boolean
  onSearchClick: () => void
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
 */
export function NavIcons({ isMobileMenuOpen, onSearchClick, onToggleMobileMenu }: Props) {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]

  return (
    <div className="z-50 flex items-center space-x-3 text-black">
      <button
        aria-label="Hľadať"
        className="hidden rounded-sm bg-transparent p-2 text-black transition-all duration-300 hover:text-brand focus:outline-none lg:flex"
        onClick={onSearchClick}
        type="button"
      >
        <Search className="h-6 w-6" />
      </button>

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
