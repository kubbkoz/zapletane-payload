'use client'

import type { ResolvedContact } from '@/lib/contact'
import type { TopBarLink } from '@/lib/navigation'

import { BookOpen, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { DEFAULT_CONTACT } from '@/lib/contact'
import { TOP_BAR_LINKS } from '@/lib/navigation'
import { cn } from '@/utilities/cn'

type Props = {
  contact?: ResolvedContact
  isHidden?: boolean
  links?: TopBarLink[]
}

/** The only icons this bar may render — the select in the Header global matches. */
const ICONS: Record<string, React.ElementType> = { BookOpen, Mail, Phone }

/**
 * Thin cream utility bar above the main header row — 1:1 port of
 * `app/components/layout/navbar/TopBar.vue` (DESIGN-SPEC.md §2.1).
 *
 * Desktop only (`hidden xl:block`); below xl it collapses to a single centred
 * phone number. Collapses on scroll via max-height + opacity (no slide —
 * §20.1 wants it instant, not animated-in).
 *
 * Phone / e-mail come from the `site-settings` global and the right-hand links
 * from the `header` global (both resolved server-side and handed down as
 * props, since this is a client component). A "highlight" link renders in the
 * darker weight with its icon and a hairline divider after it — which is
 * exactly how the blog entry used to be hard-coded.
 */
export function TopBar({ contact = DEFAULT_CONTACT, isHidden, links = TOP_BAR_LINKS }: Props) {
  return (
    <>
      <div
        className={cn(
          'relative z-50 hidden bg-brand-100 text-[10px] font-normal uppercase tracking-wider text-black/80 transition-all duration-150 ease-linear xl:block',
          isHidden
            ? 'pointer-events-none max-h-0 overflow-hidden py-0 opacity-0'
            : 'pointer-events-auto max-h-[44px] overflow-visible py-2 opacity-100',
        )}
      >
        <div className="container-page flex h-full items-center justify-between overflow-visible">
          <div className="flex items-center space-x-6">
            <a
              className="flex items-center transition-colors hover:text-black"
              href={contact.phone.href}
            >
              <Phone className="mr-2 h-3 w-3 text-brand" />
              {contact.phone.display}
            </a>
            <a
              className="flex items-center transition-colors hover:text-black"
              href={contact.email.href}
            >
              <Mail className="mr-2 h-3 w-3 text-brand" />
              {contact.email.info}
            </a>
          </div>

          <div className="flex items-center space-x-6">
            {links.map((item, index) => {
              const Icon = ICONS[item.icon]
              const showDivider = item.highlight && index < links.length - 1

              return (
                <React.Fragment key={item.id}>
                  <Link
                    className={cn(
                      'transition-colors',
                      item.highlight
                        ? 'flex items-center font-medium tracking-[0.1em] text-black hover:text-brand'
                        : 'hover:text-black',
                    )}
                    href={item.href}
                  >
                    {Icon ? <Icon className="mr-1.5 h-3.5 w-3.5 text-brand" /> : null}
                    {item.label}
                  </Link>
                  {showDivider ? <div className="h-3 w-px bg-brand/20" /> : null}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile contact strip — shown wherever the full TopBar is hidden. */}
      <div className="flex items-center justify-center bg-brand-100 px-4 py-2 text-[10px] uppercase tracking-wider text-black/70 xl:hidden">
        <a
          className="flex items-center gap-1.5 transition-colors hover:text-black"
          href={contact.phone.href}
        >
          <Phone aria-hidden="true" className="h-3 w-3 text-brand" />
          {contact.phone.display}
        </a>
      </div>
    </>
  )
}
