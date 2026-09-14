import Link from 'next/link'
import React from 'react'

export type LogoVariant = 'default' | 'light'

type Props = {
  className?: string
  variant?: LogoVariant
}

/**
 * ZAPLETANE wordmark — canonical mark, ported 1:1 from
 * app/components/layout/navbar/Logo.vue (DESIGN-SPEC.md §2.1).
 *
 * The mark is two overlapping rounded "links" (viewBox 0 0 136 108) forming
 * a heart. `default` variant (on light/cream backgrounds) uses #BC9A92
 * (front link) over #8E6B64 (back link, mix-blend-mode: multiply so the
 * overlap reads as woven rather than a flat stack). `light` variant (on
 * dark backgrounds, e.g. Footer, checkout/cart headers) swaps to
 * #E4D2CB / #BC9A92 and drops the blend mode, which would be invisible
 * against a dark surface. The wordmark text is "Zapletane" plus a period in
 * `text-accent` — the same brown dot reused standalone as the favicon mark.
 *
 * This is the ONE place the mark is drawn — never duplicate it inline
 * elsewhere (design.md's own rule).
 */
export const Logo: React.FC<Props> = ({ className, variant = 'default' }) => {
  const isLight = variant === 'light'

  return (
    <Link
      aria-label="Zapletane Domov"
      className={['group block', className].filter(Boolean).join(' ')}
      href="/"
    >
      <div
        className={[
          'logo-wordmark flex items-center font-display font-semibold leading-none',
          isLight ? 'text-white' : 'text-black',
        ].join(' ')}
      >
        <svg aria-hidden="true" className="logo-mark" fill="none" viewBox="0 0 136 108">
          <rect
            height="40"
            rx="20"
            stroke={isLight ? '#E4D2CB' : '#BC9A92'}
            strokeWidth="15"
            transform="translate(54,54) rotate(45)"
            width="80"
            x="-40"
            y="-20"
          />
          <rect
            height="40"
            rx="20"
            stroke={isLight ? '#BC9A92' : '#8E6B64'}
            strokeWidth="15"
            style={isLight ? undefined : { mixBlendMode: 'multiply' }}
            transform="translate(82,54) rotate(-45)"
            width="80"
            x="-40"
            y="-20"
          />
        </svg>
        <span>Zapletane</span>
        <span className="text-accent">.</span>
      </div>
    </Link>
  )
}
