'use client'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo'
import { CONTACT } from '@/lib/contact'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { BookOpen, ChevronRight, Info, Mail, Phone, User, X } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { navHref } from './navHref'
import { SearchBar } from './SearchBar'

type Props = {
  isOpen: boolean
  navItems: Header['navItems']
  onClose: () => void
}

/**
 * Full-screen mobile menu — port of
 * `app/components/layout/navbar/MobileMenu.vue` (DESIGN-SPEC.md §2.1): light
 * theme, slides in from the right, sticky white header with the wordmark and a
 * close button, then quick actions, the nav entries, the blog CTA and the
 * contact block.
 *
 * Rendered through a portal for the same reason the original used
 * `<Teleport to="body">`: the <nav> above it carries `gpu-boost`
 * (`transform: translateZ(0)`), which would otherwise make this overlay's
 * `fixed inset-0` resolve against the navbar instead of the viewport.
 */
export function MobileMenu({ isOpen, navItems, onClose }: Props) {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      aria-hidden={!isOpen}
      // Keeps the links out of the tab order while the panel is parked
      // off-screen (it stays mounted so the slide-in transition can run).
      inert={!isOpen}
      className={cn(
        'fixed inset-0 z-[120] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 lg:hidden gpu-boost',
        isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
      )}
    >
      <div className="sticky top-0 z-10 flex h-[var(--navbar-height-unscrolled,72px)] w-full shrink-0 items-center justify-between border-b border-gray-100 bg-white p-6">
        <Logo />

        <button
          aria-label="Zatvoriť menu"
          className="group flex h-10 w-10 items-center justify-center rounded-default bg-gray-100 text-black transition-transform active:scale-95"
          onClick={onClose}
          type="button"
        >
          <X className="h-6 w-6 transform transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>

      <div className="scrollbar-hide w-full flex-1 overflow-y-auto bg-white p-6 pb-32">
        <div className="mb-8">
          <SearchBar className="relative flex w-full" />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <Link
            className="group flex shrink-0 flex-col items-center justify-center rounded-default border border-gray-100 bg-gray-50 p-4 transition-transform active:scale-95 gpu-boost"
            href={user ? '/account' : '/login'}
            onClick={onClose}
          >
            <User
              className={cn(
                'mb-2 h-6 w-6 transition-colors group-hover:text-brand',
                user ? 'text-brand' : 'text-zinc-400',
              )}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-black">
              {user?.name?.trim().split(/\s+/)[0] || 'Prihlásiť sa'}
            </span>
          </Link>
        </div>

        {navItems?.length ? (
          <div className="mb-8">
            <h3 className="mb-4 border-b border-zinc-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Prechádzať kategórie
            </h3>
            <div className="space-y-0.5">
              {navItems.map((item) => (
                <div
                  className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/50"
                  key={item.id}
                >
                  <div className="flex items-center justify-between py-4">
                    <Link
                      className="flex-1 text-left font-tech text-lg font-black uppercase leading-none tracking-wide text-black transition-colors hover:text-brand"
                      href={navHref(item.link)}
                      onClick={onClose}
                    >
                      {item.link?.label}
                    </Link>
                    <ChevronRight className="h-5 w-5 text-zinc-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Link
          className="group mb-8 flex w-full items-center justify-between rounded-default border border-zinc-100 bg-gray-50 p-4 transition-all active:scale-[0.98] gpu-boost"
          href="/blog"
          onClick={onClose}
        >
          <div className="flex items-center">
            <div className="mr-4 flex h-10 w-10 items-center justify-center bg-brand">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <span className="mb-1 block font-tech text-lg font-black uppercase leading-none text-black transition-colors group-hover:text-brand">
                Zapletane Blog
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Novinky, tipy a inšpirácia
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-300 transition-all group-hover:translate-x-1 group-hover:text-brand" />
        </Link>

        <div className="space-y-4 font-sans text-sm font-bold uppercase tracking-widest text-black">
          <Link
            className="flex items-center py-2 transition-colors hover:text-brand"
            href="/kontakty"
            onClick={onClose}
          >
            <Phone className="mr-3 h-4 w-4 text-brand" /> Kontakty
          </Link>
          <Link
            className="flex items-center py-2 transition-colors hover:text-brand"
            href="/vsetko-o-nakupe"
            onClick={onClose}
          >
            <Info className="mr-3 h-4 w-4 text-brand" /> Všetko o nákupe
          </Link>
          <Link
            className="flex items-center py-2 transition-colors hover:text-brand"
            href="/o-nas"
            onClick={onClose}
          >
            <User className="mr-3 h-4 w-4 text-brand" /> O nás
          </Link>

          <div className="mt-6 space-y-6 border-t border-zinc-100 pt-8">
            <a
              className="flex items-center py-1 font-tech text-base font-black tracking-wider text-black transition-colors hover:text-brand"
              href={CONTACT.phone.href}
            >
              <Phone className="mr-4 h-5 w-5 text-brand" /> {CONTACT.phone.display}
            </a>
            <a
              className="flex items-center py-1 font-bold text-zinc-600 transition-colors hover:text-brand"
              href={CONTACT.email.href}
            >
              <Mail className="mr-4 h-5 w-5 text-brand" /> {CONTACT.email.info}
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
