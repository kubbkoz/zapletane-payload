'use client'

import type { ResolvedContact } from '@/lib/contact'
import type { SearchSuggestCategory, SearchSuggestProduct } from '@/lib/search'

import { useCartDrawer } from '@/components/Cart/CartDrawerProvider'
import { MobileSearchOverlay } from '@/components/Header/MobileSearchOverlay'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Home, Mail, Phone, Search, ShoppingCart, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useMemo, useState } from 'react'

type Props = {
  contact: ResolvedContact
  /** Search-overlay empty state (Z1) — resolved server-side from
   * `SiteSettings.search`; empty arrays simply hide their section. */
  recommendedCategories?: SearchSuggestCategory[]
  recommendedProducts?: SearchSuggestProduct[]
  /** `SiteSettings.search.minChars` — the overlay's live results honour the
   * same minimum as `/shop?q=`. */
  searchMinChars?: number
  searchPlaceholder?: string
}

/**
 * Fixed mobile bottom bar — the second half of the "app shell" (a static top
 * bar and a static bottom bar, with only the content between them changing).
 *
 * Port of the Nuxt app's `layout/MobileBottomNav.vue` (DESIGN-SPEC.md §2.4):
 * fixed to the bottom, 60px tall plus `pb-safe`, hairline top border, the
 * original's `shadow-[0_-10px_30px_rgba(0,0,0,0.1)]` lift, equal-width tabs,
 * active tab in brown (`text-brand` — this port's `accent` and `brand` are the
 * same espresso `#755650`), inactive `text-gray-500`, and the cart count in the
 * very same badge recipe as the header's `OpenCartButton`.
 *
 * Two deliberate departures from §2.4, both the owner's call:
 *   - six tabs, not five: Domov · Zavolať · E-mail · Hľadať · Účet · Košík.
 *     Phone and e-mail replace the original's Obľúbené (there is no wishlist
 *     in this port) and become one-tap `tel:`/`mailto:` actions off the same
 *     contact facts the header already renders.
 *   - a cream `bg-brand-50` surface instead of the original's `bg-white`, to
 *     match this storefront's header, and `md:hidden` instead of `lg:hidden`.
 *
 * The icon glyphs and the badge are not gated behind a mounted check — only
 * the *count* comes from client state, so the bar itself paints with the first
 * server HTML, exactly as the original did (it was pointedly not wrapped in
 * `<ClientOnly>`).
 */
export function MobileBottomNavClient({
  contact,
  recommendedCategories,
  recommendedProducts,
  searchMinChars,
  searchPlaceholder,
}: Props) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { cart } = useCart()
  const cartDrawer = useCartDrawer()

  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const totalQuantity = useMemo(() => {
    if (!cart?.items?.length) return 0
    return cart.items.reduce((quantity, item) => (item.quantity || 0) + quantity, 0)
  }, [cart])

  const accountHref = user ? '/account' : '/login'
  const isAccountActive = pathname.startsWith('/account') || pathname.startsWith('/login')

  return (
    <React.Fragment>
      <nav
        aria-label="Rýchla navigácia"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-brand-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.1)] md:hidden"
      >
        <ul className="grid h-[60px] grid-cols-6">
          <li>
            <Link
              aria-current={pathname === '/' ? 'page' : undefined}
              className={tabClass(pathname === '/')}
              href="/"
            >
              <Home className="h-5 w-5" strokeWidth={1.75} />
              <span className={LABEL}>Domov</span>
            </Link>
          </li>

          <li>
            <a aria-label="Zavolať nám" className={tabClass(false)} href={contact.phone.href}>
              <Phone className="h-5 w-5" strokeWidth={1.75} />
              <span className={LABEL}>Zavolať</span>
            </a>
          </li>

          <li>
            <a aria-label="Napísať nám" className={tabClass(false)} href={contact.email.href}>
              <Mail className="h-5 w-5" strokeWidth={1.75} />
              <span className={LABEL}>E-mail</span>
            </a>
          </li>

          <li>
            <button
              aria-expanded={isSearchOpen}
              aria-label="Vyhľadávanie"
              className={tabClass(isSearchOpen)}
              onClick={() => setIsSearchOpen(true)}
              type="button"
            >
              <Search className="h-5 w-5" strokeWidth={1.75} />
              <span className={LABEL}>Hľadať</span>
            </button>
          </li>

          <li>
            <Link
              aria-current={isAccountActive ? 'page' : undefined}
              aria-label="Môj účet"
              className={tabClass(isAccountActive)}
              href={accountHref}
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
              <span className={LABEL}>Účet</span>
            </Link>
          </li>

          <li>
            <button
              aria-label={
                totalQuantity ? `Nákupný košík — ${totalQuantity} položiek` : 'Nákupný košík'
              }
              className={tabClass(Boolean(cartDrawer?.isOpen))}
              onClick={() => cartDrawer?.open()}
              type="button"
            >
              <span className="relative flex items-center justify-center">
                <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                {totalQuantity ? (
                  <span className="absolute -right-2.5 -top-2.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-[3px] text-[9px] font-bold leading-none text-white ring-2 ring-brand-50">
                    {totalQuantity > 99 ? '99+' : totalQuantity}
                  </span>
                ) : null}
              </span>
              <span className={LABEL}>Košík</span>
            </button>
          </li>
        </ul>
      </nav>

      <MobileSearchOverlay
        isOpen={isSearchOpen}
        minChars={searchMinChars}
        onClose={() => setIsSearchOpen(false)}
        placeholder={searchPlaceholder}
        recommendedCategories={recommendedCategories}
        recommendedProducts={recommendedProducts}
      />
    </React.Fragment>
  )
}

/** Tiny uppercase caption under each glyph — §2.4's label face. */
const LABEL = 'font-tech text-[9px] font-bold uppercase leading-none tracking-wide'

/** Every tab fills its grid cell so the whole 60px column is the hit target. */
const tabClass = (isActive: boolean) =>
  cn(
    'flex h-full w-full flex-col items-center justify-center gap-1.5 bg-transparent px-0.5 text-center transition-colors duration-200',
    isActive ? 'text-brand' : 'text-gray-500 hover:text-brand',
  )
