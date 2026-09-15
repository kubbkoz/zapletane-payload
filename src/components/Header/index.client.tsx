'use client'

import type { Header } from '@/payload-types'
import type { ResolvedContact } from '@/lib/contact'
import type { SocialLink, TopBarLink, TopBarSettings } from '@/lib/navigation'

import { Logo } from '@/components/Logo'
import { cn } from '@/utilities/cn'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { DesktopNav } from './DesktopNav'
import { MobileMenu } from './MobileMenu'
import { NavIcons } from './NavIcons'
import { SearchBar } from './SearchBar'
import { TopBar } from './TopBar'

type Props = {
  contact: ResolvedContact
  header: Header
  searchPlaceholder?: string
  socialLinks: SocialLink[]
  topBar: TopBarSettings
  topBarLinks: TopBarLink[]
}

/**
 * ZAPLETANE navbar — 1:1 port of `app/components/layout/Navbar.vue`
 * (DESIGN-SPEC.md §2.1). Three stacked rows inside one fixed <nav>:
 *
 *   1. TopBar          cream utility bar, hides on scroll everywhere
 *   2. main row        Logo · SearchBar · NavIcons, cream (`bg-brand-50`),
 *                      translucent + blurred once scrolled — persistent
 *   3. DesktopNav      white nav strip, hides on scroll on listing/search
 *                      pages, stays on the homepage and product detail
 *
 * The navbar's height is never a CSS constant: a ResizeObserver measures the
 * inner wrapper and writes `--navbar-height-*` onto <html>, and the spacer
 * <div> after the <nav> consumes `--navbar-height-current` so the fixed header
 * reserves its own space without CLS (169px desktop fallback, as in the
 * original's critical CSS).
 */
export function HeaderClient({ contact, header, searchPlaceholder, socialLinks, topBar, topBarLinks }: Props) {
  const navItems = header?.navItems || []
  const pathname = usePathname()

  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navbarInnerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // §20.1 — TopBar collapses on every page type; DesktopNav only on listing /
  // search / content pages, never on the homepage or a product detail page.
  const isHomePage = pathname === '/'
  const isProductPage = pathname.startsWith('/products/')
  const shouldHideTopBar = isScrolled
  const shouldHideDesktopNav = isScrolled && !isHomePage && !isProductPage

  useEffect(() => {
    let frame: null | number = null

    const handleScroll = () => {
      if (frame !== null) return

      frame = requestAnimationFrame(() => {
        frame = null
        const scrolled = window.scrollY > 10
        setIsScrolled(scrolled)
        document.documentElement.classList.toggle('is-navbar-scrolled', scrolled)
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const inner = navbarInnerRef.current
    if (!inner) return

    const root = document.documentElement

    const apply = (height: number) => {
      root.style.setProperty('--navbar-height-current', `${height}px`)
      root.style.setProperty('--navbar-height-scrolled', `${height}px`)

      if (window.scrollY < 10) {
        root.style.setProperty('--navbar-height-full', `${height}px`)
        root.style.setProperty('--navbar-height-unscrolled', `${height}px`)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) apply(entry.target.clientHeight)
    })

    observer.observe(inner)
    apply(inner.clientHeight)

    return () => observer.disconnect()
  }, [])

  // Close the mobile menu on navigation, and never leave the body locked.
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <div>
      <nav
        className={cn(
          'fixed top-0 start-0 z-50 flex w-full flex-col transition-transform duration-200 ease-in-out gpu-boost',
          isScrolled ? 'shadow-lg' : 'shadow-none',
        )}
      >
        <div ref={navbarInnerRef}>
          <TopBar
            contact={contact}
            enabled={topBar.enabled}
            isHidden={shouldHideTopBar}
            links={topBarLinks}
            marqueeSpeed={topBar.marqueeSpeed}
            marqueeText={topBar.marqueeText}
            mode={topBar.mode}
          />

          {/* Owner's call: the bar is always fully opaque — no translucent
              scrolled state, no blur (content must never shimmer through). */}
          {/* `small-desktop:py-3` (Z10) — on a 1280–1599px laptop the row gives
              back 8px of the 32px it spends on padding. Below 1024 and from
              1600 up the variant does not match, so the row renders exactly as
              before. The row's content height is set by the search field
              (50px), not the logo (27px), so nothing is scaled. */}
          <div
            className="relative z-40 border-b border-gray-200 bg-brand-50 py-4 transition-all duration-300 ease-linear small-desktop:py-3"
            id="navbar-main-row"
          >
            <div className="container-page">
              <div className="flex items-center justify-between gap-8">
                <Logo />

                <SearchBar inputRef={searchInputRef} placeholder={searchPlaceholder} />

                <NavIcons
                  isMobileMenuOpen={isMobileMenuOpen}
                  onToggleMobileMenu={() => setIsMobileMenuOpen((open) => !open)}
                />
              </div>
            </div>
          </div>

          <DesktopNav isHidden={shouldHideDesktopNav} navItems={navItems} />
        </div>

        <MobileMenu
          contact={contact}
          isOpen={isMobileMenuOpen}
          navItems={navItems}
          onClose={() => setIsMobileMenuOpen(false)}
          secondaryLinks={topBarLinks}
          socialLinks={socialLinks}
        />
      </nav>

      {/* Spacer — reserves the fixed navbar's measured height (no transition:
          it follows ResizeObserver frames, §20.2). `.navbar-spacer` carries the
          169px / 106px first-paint fallbacks from globals.css. */}
      <div className="navbar-spacer pointer-events-none w-full opacity-0" />
    </div>
  )
}
