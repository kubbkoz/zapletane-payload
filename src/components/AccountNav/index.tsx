'use client'

import { cn } from '@/utilities/cn'
import {
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  className?: string
}

const navItems = [
  { exact: true, href: '/account', icon: LayoutDashboard, label: 'Prehľad' },
  { href: '/account/settings', icon: UserRound, label: 'Moje údaje' },
  { href: '/account/addresses', icon: MapPin, label: 'Adresy' },
  // Z10 — `/wishlist` lives outside the (account) route group but is an
  // account screen in every other sense: customers only, per-user data.
  { href: '/wishlist', icon: Heart, label: 'Obľúbené' },
  { href: '/orders', icon: Package, label: 'Objednávky' },
  { href: '/account/returns', icon: RotateCcw, label: 'Reklamácia' },
]

/**
 * Account navigation in two shapes from one source of truth: a scrollable chip
 * row below `lg` (where the sidebar would eat the whole screen) and the sticky
 * sidebar card above it. No fixed positioning — the app shell already offsets
 * the mobile bottom bar.
 */
export const AccountNav: React.FC<Props> = ({ className }) => {
  const pathname = usePathname()

  const isActive = (item: (typeof navItems)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <div className={cn('w-full', className)}>
      {/* Mobile / tablet: horizontal chips */}
      <nav
        aria-label="Navigácia účtu"
        className="flex gap-2 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)

          return (
            <Link
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-default border px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-widest transition-colors duration-200',
                active
                  ? 'border-black bg-black text-white'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-brand/40 hover:text-black',
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className={cn('size-3.5 shrink-0', active ? 'text-brand-300' : 'text-gray-400')} />
              {item.label}
            </Link>
          )
        })}

        <Link
          className="flex shrink-0 items-center gap-2 rounded-default border border-gray-100 bg-white px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-brand/40 hover:text-brand"
          href="/logout"
        >
          <LogOut className="size-3.5" />
          Odhlásiť
        </Link>
      </nav>

      {/* Desktop: sidebar card */}
      <div className="hidden rounded-default border border-gray-100 bg-white shadow-sm lg:sticky lg:top-28 lg:block">
        <nav aria-label="Navigácia účtu" className="flex flex-col py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)

            return (
              <Link
                className={cn(
                  'flex items-center justify-between gap-2 px-6 py-[18px] text-left font-sans text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
                  active
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black',
                )}
                href={item.href}
                key={item.href}
              >
                <span className="flex flex-1 items-center gap-4">
                  <Icon
                    className={cn('size-4 shrink-0', active ? 'text-brand-300' : 'text-gray-400')}
                  />
                  <span className="leading-tight">{item.label}</span>
                </span>
                <ChevronRight
                  className={cn(
                    'size-3.5 shrink-0 transition-transform',
                    active ? 'translate-x-1 text-white' : 'text-gray-300',
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-100 px-6 py-4">
          <Link
            className={cn(
              'flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest transition-colors',
              pathname === '/logout' ? 'text-black' : 'text-gray-400 hover:text-brand',
            )}
            href="/logout"
          >
            <LogOut className="size-4" />
            Odhlásiť sa
          </Link>
        </div>
      </div>
    </div>
  )
}
