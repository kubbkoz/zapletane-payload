'use client'

import type { Header } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/cn'
import { usePathname } from 'next/navigation'
import React from 'react'

import { navHref } from './navHref'

type Props = {
  isHidden?: boolean
  navItems: Header['navItems']
}

/**
 * White navigation strip under the main header row — port of
 * `app/components/layout/navbar/DesktopNav.vue` (DESIGN-SPEC.md §2.1).
 *
 * `bg-white border-t border-gray-100` (not cream, not black), links
 * `text-black hover:text-brand`, the active entry `text-accent`. Collapses via
 * max-height + opacity in 150ms linear, same as the TopBar.
 *
 * The original drove this off the live Shopware category tree and opened a
 * mega menu on hover; here the entries come from the `header` global
 * (label + link), so there is no second level to open.
 */
export function DesktopNav({ isHidden, navItems }: Props) {
  const pathname = usePathname()

  if (!navItems?.length) return null

  return (
    <div
      className={cn(
        'relative z-30 hidden w-full transition-[max-height,opacity] duration-150 ease-linear lg:block',
        isHidden ? 'overflow-hidden' : 'overflow-visible',
      )}
      style={{ maxHeight: isHidden ? 0 : 80 }}
    >
      <div
        className={cn(
          'w-full overflow-visible border-t border-gray-100 bg-white transition-all duration-150 ease-linear',
          isHidden ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100',
        )}
      >
        <div className="container-page">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              {navItems.map((item) => {
                const url = navHref(item.link)
                const isActive = url !== '/' && pathname.startsWith(url)

                return (
                  <div className="static px-2 py-4" key={item.id}>
                    <CMSLink
                      {...item.link}
                      appearance="inline"
                      className={cn(
                        'flex items-center font-tech text-sm font-bold uppercase tracking-widest text-black transition-all duration-300 hover:text-brand',
                        isActive && 'text-accent',
                      )}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
