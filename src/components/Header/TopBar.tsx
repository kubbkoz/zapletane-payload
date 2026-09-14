'use client'

import { CONTACT } from '@/lib/contact'
import { cn } from '@/utilities/cn'
import { BookOpen, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
  isHidden?: boolean
}

/**
 * Thin cream utility bar above the main header row — 1:1 port of
 * `app/components/layout/navbar/TopBar.vue` (DESIGN-SPEC.md §2.1).
 *
 * Desktop only (`hidden xl:block`); below xl it collapses to a single centred
 * phone number. Collapses on scroll via max-height + opacity (no slide —
 * §20.1 wants it instant, not animated-in).
 */
export function TopBar({ isHidden }: Props) {
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
              href={CONTACT.phone.href}
            >
              <Phone className="mr-2 h-3 w-3 text-brand" />
              {CONTACT.phone.display}
            </a>
            <a
              className="flex items-center transition-colors hover:text-black"
              href={CONTACT.email.href}
            >
              <Mail className="mr-2 h-3 w-3 text-brand" />
              {CONTACT.email.info}
            </a>
          </div>

          <div className="flex items-center space-x-6">
            <Link
              className="flex items-center font-medium tracking-[0.1em] text-black transition-colors hover:text-brand"
              href="/blog"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5 text-brand" />
              Zapletane Blog
            </Link>
            <div className="h-3 w-px bg-brand/20" />
            <Link className="transition-colors hover:text-black" href="/kontakty">
              Kontakty
            </Link>
            <Link className="transition-colors hover:text-black" href="/vsetko-o-nakupe">
              Všetko o nákupe
            </Link>
            <Link className="transition-colors hover:text-black" href="/o-nas">
              O nás
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile contact strip — shown wherever the full TopBar is hidden. */}
      <div className="flex items-center justify-center bg-brand-100 px-4 py-2 text-[10px] uppercase tracking-wider text-black/70 xl:hidden">
        <a
          className="flex items-center gap-1.5 transition-colors hover:text-black"
          href={CONTACT.phone.href}
        >
          <Phone aria-hidden="true" className="h-3 w-3 text-brand" />
          {CONTACT.phone.display}
        </a>
      </div>
    </>
  )
}
