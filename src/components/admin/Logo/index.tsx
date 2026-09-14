import React from 'react'

/**
 * ZAPLETANE wordmark for the Payload admin login screen
 * (`admin.components.graphics.Logo`).
 *
 * The SVG markup is DELIBERATELY DUPLICATED from src/components/Logo/Logo.tsx
 * instead of imported: the storefront component is a `next/link` wrapped
 * Tailwind component owned by the storefront side of the codebase, and the
 * admin panel neither ships Tailwind nor wants a link to `/` here. Keep the two
 * rects (geometry, rx, stroke-width) in sync with the storefront mark if the
 * brand mark ever changes — this is the only sanctioned copy.
 *
 * The two rects carry classes rather than `stroke` attributes: strokes are set
 * from --zap-logo-front / --zap-logo-back in src/app/(payload)/custom.scss (§6),
 * which flip per theme so the mark stays legible on both the cream and the
 * near-black ground. (Keeping `var()` out of presentation attributes also
 * avoids relying on attribute-level custom-property substitution.)
 */
export const Logo: React.FC = () => (
  <div className="zap-logo">
    <svg
      aria-hidden="true"
      className="zap-logo__mark"
      fill="none"
      viewBox="0 0 136 108"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        className="zap-logo__front"
        height="40"
        rx="20"
        strokeWidth="15"
        transform="translate(54,54) rotate(45)"
        width="80"
        x="-40"
        y="-20"
      />
      <rect
        className="zap-logo__back"
        height="40"
        rx="20"
        strokeWidth="15"
        transform="translate(82,54) rotate(-45)"
        width="80"
        x="-40"
        y="-20"
      />
    </svg>
    <span className="zap-logo__word">
      Zapletane<span className="zap-logo__dot">.</span>
    </span>
  </div>
)

export default Logo
