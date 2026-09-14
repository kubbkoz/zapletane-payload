'use client'

import { cn } from '@/utilities/cn'
import { ChevronRight, LogOut, MapPin, Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  className?: string
}

const navItems = [
  { href: '/account', label: 'Nastavenia účtu', icon: Settings },
  { href: '/account/addresses', label: 'Adresy', icon: MapPin },
  { href: '/orders', label: 'Objednávky', icon: Package },
]

export const AccountNav: React.FC<Props> = ({ className }) => {
  const pathname = usePathname()

  return (
    <div
      className={cn(
        'rounded-default border border-gray-100 bg-white shadow-sm lg:sticky lg:top-28',
        className,
      )}
    >
      <nav className="flex flex-col py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/account' && pathname.includes(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between gap-2 px-6 py-[18px] text-left text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
                isActive ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-black',
              )}
            >
              <span className="flex flex-1 items-center gap-4">
                <Icon
                  className={cn('size-4 shrink-0', isActive ? 'text-brand' : 'text-gray-400')}
                />
                <span className="leading-tight">{item.label}</span>
              </span>
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  isActive ? 'translate-x-1 text-white' : 'text-gray-300',
                )}
              />
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-100 px-6 py-4">
        <Link
          href="/logout"
          className={cn(
            'flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors',
            pathname === '/logout' ? 'text-black' : 'text-gray-400 hover:text-brand',
          )}
        >
          <LogOut className="size-4" />
          Odhlásiť sa
        </Link>
      </div>
    </div>
  )
}
