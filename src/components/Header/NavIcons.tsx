'use client'

import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { Menu, Search, User, X } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'

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

      <div className="flex items-center">
        <Suspense fallback={<OpenCartButton />}>
          <Cart />
        </Suspense>
      </div>

      <button
        aria-label="Menu"
        className={cn(
          'rounded-sm bg-transparent p-2 text-black transition-colors hover:text-brand lg:hidden',
        )}
        onClick={onToggleMobileMenu}
        type="button"
      >
        {isMobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
      </button>
    </div>
  )
}
