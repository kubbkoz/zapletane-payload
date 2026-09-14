'use client'

import type { Header } from '@/payload-types'

import { ChevronDown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import React from 'react'

import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/cn'

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
 * Entries come from the `header` global. An entry that carries `children`
 * (one level, as the global allows) opens a quiet dropdown on hover/focus:
 * white panel, `border-gray-100`, `shadow-panel`, `font-tech` uppercase rows —
 * the design system's panel, not a mega menu. Entries without children behave
 * exactly as before, so a nav with no children renders byte-identical markup.
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
                const children = (item.children || []).filter((child) => child?.link?.label)

                return (
                  <div
                    className={cn('static px-2 py-4', children.length > 0 && 'group relative')}
                    key={item.id}
                  >
                    {/* No children → exactly the markup this strip always had. */}
                    {children.length === 0 ? (
                      <CMSLink
                        {...item.link}
                        appearance="inline"
                        className={cn(
                          'flex items-center font-tech text-sm font-bold uppercase tracking-widest text-black transition-all duration-300 hover:text-brand',
                          isActive && 'text-accent',
                        )}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <CMSLink
                          {...item.link}
                          appearance="inline"
                          className={cn(
                            'flex items-center font-tech text-sm font-bold uppercase tracking-widest text-black transition-all duration-300 hover:text-brand',
                            isActive && 'text-accent',
                          )}
                        />
                        <ChevronDown
                          aria-hidden="true"
                          className="size-3.5 text-gray-400 transition-transform duration-200 group-hover:rotate-180 group-hover:text-brand"
                        />
                      </div>
                    )}

                    {children.length > 0 ? (
                      <div
                        className={cn(
                          'invisible absolute left-0 top-full z-50 min-w-[220px] translate-y-1 rounded-default border border-gray-100 bg-white py-2 opacity-0 shadow-panel transition-all duration-200 ease-[var(--ease-out)]',
                          'group-hover:visible group-hover:translate-y-0 group-hover:opacity-100',
                          'group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100',
                          'motion-reduce:transition-none',
                        )}
                      >
                        {children.map((child) => (
                          <CMSLink
                            {...child.link}
                            appearance="inline"
                            className="block px-5 py-2.5 font-tech text-xs font-bold uppercase tracking-widest text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand"
                            key={child.id}
                          />
                        ))}
                      </div>
                    ) : null}
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
