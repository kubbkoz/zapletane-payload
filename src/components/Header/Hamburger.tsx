'use client'

import { cn } from '@/utilities/cn'
import React from 'react'

type Props = {
  className?: string
  isOpen: boolean
  onClick: () => void
}

/**
 * Menu trigger — a single CSS hamburger that morphs into an X.
 *
 * Replaces the previous `{isOpen ? <X/> : <Menu/>}` lucide swap, which
 * "preblikovalo": two different components mean React tears the whole `<svg>`
 * out of the DOM and paints a new one on every toggle — an untransitionable
 * hard cut — and the two glyphs do not share a baseline, so the icon cluster
 * re-measured on each press.
 *
 * Here nothing mounts or unmounts and nothing is measured: three absolutely
 * positioned 2px spans inside a fixed 44×44 hit area (22×14 glyph box) animate
 * `transform` and `opacity` only — never width, height, or any box property —
 * so the morph is GPU-only and provably zero-CLS. The top/bottom rules slide
 * 6px to the centre line and counter-rotate ±45°, the middle one fades.
 *
 * 220ms on `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`, design.md §9 — the
 * same token the mobile menu's stagger uses), dropped entirely under
 * `prefers-reduced-motion`, where the state change is instant instead.
 */
const LINE_BASE =
  'absolute left-0 block h-[2px] w-full rounded-full bg-current transition-[transform,opacity] duration-[220ms] ease-[var(--ease-out)] motion-reduce:transition-none'

export function HamburgerButton({ className, isOpen, onClick }: Props) {
  return (
    <button
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Zavrieť menu' : 'Otvoriť menu'}
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-transparent text-black transition-colors duration-200 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden',
        className,
      )}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="pointer-events-none relative block h-[14px] w-[22px]">
        <span
          className={cn(LINE_BASE, 'top-0')}
          style={{ transform: isOpen ? 'translateY(6px) rotate(45deg)' : 'none' }}
        />
        <span
          className={cn(LINE_BASE, 'top-1/2 -mt-px')}
          style={{ opacity: isOpen ? 0 : 1, transform: 'none' }}
        />
        <span
          className={cn(LINE_BASE, 'bottom-0')}
          style={{ transform: isOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }}
        />
      </span>
    </button>
  )
}
