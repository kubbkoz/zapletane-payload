'use client'

import type { Header } from '@/payload-types'
import type { ResolvedContact } from '@/lib/contact'
import type { SocialLink, TopBarLink } from '@/lib/navigation'

import { Logo } from '@/components/Logo'
import { SocialIcon } from '@/components/SocialIcon'
import { DEFAULT_CONTACT } from '@/lib/contact'
import { isExternalHref, SOCIAL_LINKS, TOP_BAR_LINKS } from '@/lib/navigation'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'
import { BookOpen, Mail, Phone, User, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { navHref } from './navHref'
import { SearchBar } from './SearchBar'

type Props = {
  contact?: ResolvedContact
  isOpen: boolean
  navItems: Header['navItems']
  onClose: () => void
  secondaryLinks?: TopBarLink[]
  socialLinks?: SocialLink[]
}

/** The only icons a secondary (TopBar) link may carry. */
const SECONDARY_ICONS: Record<string, React.ElementType> = { BookOpen, Mail, Phone }

/**
 * Full-screen mobile menu — REDESIGNED presentation (visible refresh, per the
 * owner's request). Data contract, trigger and portal mechanics are
 * unchanged from the previous version; only what gets rendered inside the
 * portal changed:
 *
 *   1. Top row       Logo + 40×40 bordered close chip
 *   2. Search        compact SearchBar (mobile's only search entry point —
 *                     NavIcons hides its own search button below `lg`)
 *   3. Main nav       large display-type list, numbered, staggered entrance,
 *                     active route in `text-brand`; an item's optional
 *                     `children` (Header global, one level) render indented
 *                     under it in the small uppercase font-tech face
 *   4. Secondary      the TopBar's quick links — now the `header` global's
 *                     `topBar.links` array, no longer hard-coded — + the
 *                     account link (mobile's only account entry point:
 *                     NavIcons hides it below `md`), small uppercase font-tech
 *   5. Contact        phone + email + social icon-ring row, from the
 *                     `site-settings` and `footer` globals
 *
 * Every CMS value arrives as a prop (this is a client component); each prop
 * defaults to the constant the menu used to hard-code, so nothing changes until
 * an editor changes it.
 *
 * Still rendered through a portal for the same reason as before: the <nav>
 * above it carries `gpu-boost` (`transform: translateZ(0)`), which would
 * otherwise make this overlay's `fixed inset-0` resolve against the navbar
 * instead of the viewport. Body scroll-lock is handled by the parent
 * (`HeaderClient`), which toggles `document.body.style.overflow` whenever
 * `isMobileMenuOpen` changes.
 */
export function MobileMenu({
  contact = DEFAULT_CONTACT,
  isOpen,
  navItems,
  onClose,
  secondaryLinks = TOP_BAR_LINKS,
  socialLinks = SOCIAL_LINKS,
}: Props) {
  const { user } = useAuth()
  const pathname = usePathname()
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

  const items = navItems ?? []
  // Stagger index shared across the whole content column: nav items get
  // 0..n-1 (also doubles as their visible "01/02/…" number), the secondary
  // links row and the contact block each get one slot right after.
  const secondaryDelayIndex = items.length
  const contactDelayIndex = items.length + 1

  return createPortal(
    <div
      aria-hidden={!isOpen}
      // Keeps focus out of the panel while it's parked invisible (it stays
      // mounted so the fade/stagger transition can run on open + close).
      inert={!isOpen}
      className={cn(
        'fixed inset-0 z-[120] flex h-[100dvh] w-full flex-col overflow-hidden bg-brand-50 lg:hidden',
        'transition-opacity ease-[var(--ease-out)] motion-reduce:transition-none',
        isOpen
          ? 'pointer-events-auto opacity-100 duration-300'
          : 'pointer-events-none opacity-0 duration-150',
      )}
    >
      {/* 1. Top row — wordmark + close chip */}
      <div className="flex h-[var(--navbar-height-unscrolled,72px)] w-full shrink-0 items-center justify-between border-b border-gray-200 px-6">
        <Logo />

        <button
          aria-label="Zatvoriť menu"
          className="flex h-10 w-10 items-center justify-center rounded-default border border-gray-300 text-black transition-colors duration-200 hover:border-brand hover:text-brand active:scale-95"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="scrollbar-hide w-full flex-1 overflow-y-auto px-6 pb-safe pt-8">
        {/* 2. Search — the only search entry point on mobile widths */}
        <SearchBar className="relative mb-10 flex w-full" />

        {/* 3. Main nav — large display type, numbered, staggered entrance */}
        {items.length ? (
          <nav aria-label="Hlavná navigácia" className="mb-10">
            <div className="flex flex-col">
              {items.map((item, index) => {
                const href = navHref(item.link)
                const isActive = pathname === href || pathname.startsWith(`${href}/`)
                const children = (item.children || []).filter((child) => child?.link?.label)

                return (
                  <RevealItem
                    className="border-b border-gray-200 last:border-0"
                    delayIndex={index}
                    isOpen={isOpen}
                    key={item.id}
                  >
                    <Link
                      className="group flex w-full items-center gap-4 py-3.5"
                      href={href}
                      onClick={onClose}
                    >
                      <span
                        className={cn(
                          'font-tech text-xs tabular-nums transition-colors',
                          isActive ? 'text-brand' : 'text-gray-400 group-hover:text-brand',
                        )}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'flex-1 font-display text-[clamp(28px,8vw,40px)] font-medium normal-case leading-[1.05] tracking-tight transition-colors',
                          isActive ? 'text-brand' : 'text-black group-hover:text-brand',
                        )}
                      >
                        {item.link?.label}
                      </span>
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-brand"
                        />
                      ) : null}
                    </Link>

                    {/* Sub-items — indented onto the parent's label column, in
                        the small uppercase face so they never compete with it. */}
                    {children.length ? (
                      <ul className="mb-4 flex flex-col gap-3 pl-9">
                        {children.map((child) => {
                          const childHref = navHref(child.link)
                          const isChildActive = pathname === childHref

                          return (
                            <li key={child.id}>
                              <Link
                                className={cn(
                                  'font-tech text-xs font-bold uppercase tracking-widest transition-colors hover:text-brand',
                                  isChildActive ? 'text-brand' : 'text-gray-600',
                                )}
                                href={childHref}
                                onClick={onClose}
                              >
                                {child.link?.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </RevealItem>
                )
              })}
            </div>
          </nav>
        ) : null}

        {/* 4. Secondary links — TopBar's quick links + account (mobile-only entry point) */}
        <RevealItem
          className="mb-10 border-t border-gray-200 pt-8"
          delayIndex={secondaryDelayIndex}
          isOpen={isOpen}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 font-tech text-xs font-bold uppercase tracking-widest text-gray-600">
            {secondaryLinks.map((item) => {
              const Icon = SECONDARY_ICONS[item.icon]

              return (
                <Link
                  className={cn(
                    'transition-colors hover:text-brand',
                    Icon && 'flex items-center gap-2',
                  )}
                  href={item.href}
                  key={item.id}
                  onClick={onClose}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 text-brand" /> : null}
                  {item.label}
                </Link>
              )
            })}
            <Link
              className="flex items-center gap-2 transition-colors hover:text-brand"
              href={user ? '/account' : '/login'}
              onClick={onClose}
            >
              <User className="h-3.5 w-3.5 text-brand" />
              {user?.name?.trim().split(/\s+/)[0] || 'Prihlásiť sa'}
            </Link>
          </div>
        </RevealItem>

        {/* 5. Contact block — phone / email + social icon-ring row */}
        <RevealItem
          className="border-t border-gray-200 pb-10 pt-8"
          delayIndex={contactDelayIndex}
          isOpen={isOpen}
        >
          <div className="mb-6 flex flex-col gap-3">
            <a
              className="flex items-center gap-3 font-tech text-lg font-bold text-black transition-colors hover:text-brand"
              href={contact.phone.href}
            >
              <Phone className="h-5 w-5 text-brand" /> {contact.phone.display}
            </a>
            <a
              className="flex items-center gap-3 text-sm font-medium text-gray-600 transition-colors hover:text-brand"
              href={contact.email.href}
            >
              <Mail className="h-5 w-5 text-brand" /> {contact.email.info}
            </a>
          </div>

          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                aria-label={social.label}
                className="icon-ring h-10 w-10 border border-gray-300 text-gray-600 hover:border-brand hover:bg-brand hover:text-white"
                href={social.url}
                key={social.id}
                {...(isExternalHref(social.url)
                  ? { rel: 'noopener noreferrer', target: '_blank' }
                  : {})}
              >
                <SocialIcon className="h-4 w-4" platform={social.platform} />
              </a>
            ))}
          </div>
        </RevealItem>
      </div>
    </div>,
    document.body,
  )
}

/**
 * One stop of the panel's stagger sequence: fades + translates up into place
 * on open (delay = `delayIndex * 60ms`, per design.md's no-bounce rule —
 * reuses the `--ease-out` token, the same `cubic-bezier(0.22, 1, 0.36, 1)`
 * already defined in globals.css), and collapses uniformly (no stagger, no
 * transform) in a quick 150ms on close. `prefers-reduced-motion` drops the
 * transform entirely and makes the fade instant.
 */
function RevealItem({
  children,
  className,
  delayIndex,
  isOpen,
}: {
  children: React.ReactNode
  className?: string
  delayIndex: number
  isOpen: boolean
}) {
  return (
    <div
      className={cn(
        'transition-[opacity,transform] ease-[var(--ease-out)] motion-reduce:transition-none motion-reduce:translate-y-0',
        isOpen ? 'translate-y-0 opacity-100 duration-500' : 'translate-y-4 opacity-0 duration-150',
        className,
      )}
      style={{ transitionDelay: isOpen ? `${delayIndex * 60}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
