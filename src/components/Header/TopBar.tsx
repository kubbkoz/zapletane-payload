'use client'

import type { ResolvedContact } from '@/lib/contact'
import type { TopBarLink } from '@/lib/navigation'

import { BookOpen, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { DEFAULT_CONTACT } from '@/lib/contact'
import { TOP_BAR_LINKS } from '@/lib/navigation'
import { cn } from '@/utilities/cn'

type TopBarMode = 'contact' | 'marquee'
type TopBarSpeed = 'fast' | 'normal' | 'slow'

type Props = {
  contact?: ResolvedContact
  /** Master switch (`topBar.enabled` on the Header global). `false` renders nothing. */
  enabled?: boolean
  isHidden?: boolean
  links?: TopBarLink[]
  marqueeSpeed?: TopBarSpeed
  marqueeText?: string
  /** Content mode (`topBar.mode` on the Header global). */
  mode?: TopBarMode
}

/** The only icons this bar may render — the select in the Header global matches. */
const ICONS: Record<string, React.ElementType> = { BookOpen, Mail, Phone }

/** Seconds per loop, keyed to the Header global's `marqueeSpeed` select. */
const MARQUEE_DURATIONS: Record<TopBarSpeed, string> = {
  fast: '18s',
  normal: '30s',
  slow: '45s',
}

const FALLBACK_MARQUEE_TEXT = 'ZAPLETANE'

/**
 * Thin cream utility bar above the main header row — 1:1 port of
 * `app/components/layout/navbar/TopBar.vue` (DESIGN-SPEC.md §2.1), extended
 * with a backend-driven content mode (Header global → `topBar.enabled` /
 * `topBar.mode`):
 *
 *   - `enabled === false` → renders nothing. The navbar's ResizeObserver
 *     (index.client.tsx) measures whatever the inner wrapper actually
 *     contains, so an absent TopBar just yields a shorter navbar — no
 *     leftover border or CLS to handle here.
 *   - `mode === 'contact'` (default) — exactly the original markup: a
 *     desktop-only bar (`hidden xl:block`, phone/e-mail + `links`) that
 *     collapses to a centred phone number below xl.
 *   - `mode === 'marquee'` — one bar at every breakpoint: a single-line,
 *     seamless infinite scroll of `marqueeText`. `.topbar-marquee`
 *     (globals.css) is a flex track holding two identical copies of the text
 *     — the second `aria-hidden` — animated `translateX(0 → -50%)`, so
 *     exactly one copy-width of travel loops with no seam. Paused on hover;
 *     `prefers-reduced-motion` swaps to a static, truncated single line.
 *
 * Both modes still collapse on scroll via max-height + opacity (no slide —
 * §20.1 wants it instant, not animated-in), driven by the same `isHidden`
 * prop either way.
 *
 * Phone / e-mail come from the `site-settings` global; `links` and the mode
 * fields come from the `header` global (both resolved server-side and handed
 * down as props, since this is a client component). A "highlight" link
 * renders in the darker weight with its icon and a hairline divider after it
 * — which is exactly how the blog entry used to be hard-coded.
 */
export function TopBar({
  contact = DEFAULT_CONTACT,
  enabled = true,
  isHidden,
  links = TOP_BAR_LINKS,
  marqueeSpeed = 'normal',
  marqueeText,
  mode = 'contact',
}: Props) {
  if (!enabled) return null

  // `small-desktop:py-1.5` (Z10) trims the visible bar by 4px on a 1280–1599px
  // laptop. Only on the visible branch: the collapsed branch is `py-0` and must
  // stay exactly 0 at every width, so the variant would fight it there.
  const collapseClasses = isHidden
    ? 'pointer-events-none max-h-0 overflow-hidden py-0 opacity-0'
    : 'pointer-events-auto max-h-[44px] overflow-visible py-2 opacity-100 small-desktop:py-1.5'

  if (mode === 'marquee') {
    const text = marqueeText?.trim() || FALLBACK_MARQUEE_TEXT

    return (
      <div
        className={cn(
          'relative z-50 bg-brand-100 text-[10px] font-tech font-normal uppercase tracking-wider text-black/80 transition-all duration-150 ease-linear',
          collapseClasses,
          'overflow-hidden',
        )}
      >
        <div className="container-page overflow-hidden">
          <div
            className={cn(
              'topbar-marquee items-center whitespace-nowrap',
              'hover:[animation-play-state:paused]',
              'motion-reduce:w-full motion-reduce:animate-none',
            )}
            style={{ '--topbar-marquee-duration': MARQUEE_DURATIONS[marqueeSpeed] } as React.CSSProperties}
          >
            <span className="inline-block shrink-0 pr-16 motion-reduce:block motion-reduce:w-full motion-reduce:shrink motion-reduce:truncate motion-reduce:pr-0">
              {text}
            </span>
            <span aria-hidden="true" className="inline-block shrink-0 pr-16 motion-reduce:hidden">
              {text}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'relative z-50 hidden bg-brand-100 text-[10px] font-normal uppercase tracking-wider text-black/80 transition-all duration-150 ease-linear xl:block',
          collapseClasses,
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

      {/* Mobile contact strip — shown wherever the full TopBar is hidden. It
          also covers the 1024–1279px slice of the small-desktop range, so it
          takes the same 4px trim there (below 1024 it is untouched). */}
      <div className="flex items-center justify-center bg-brand-100 px-4 py-2 text-[10px] uppercase tracking-wider text-black/70 small-desktop:py-1.5 xl:hidden">
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
