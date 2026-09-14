import React from 'react'

/**
 * ZAPLETANE mark for the Payload admin nav / step-nav "home" link
 * (`admin.components.graphics.Icon`).
 *
 * Payload renders this inside an 18×18 (16×16 on small screens) box, so the
 * component must fill 100% of its parent (hence the width/height="100%"
 * attributes, matching Payload's own PayloadIcon) and needs a SQUARE viewBox.
 * The mark's tight bounds are 136×108 centred on (68, 54) —
 * `viewBox="0 -14 136 136"` squares that off without cropping the rounded links.
 *
 * Strokes are set from --zap-logo-front / --zap-logo-back in
 * src/app/(payload)/custom.scss (§6), per theme.
 *
 * Same duplication note as src/components/admin/Logo: this SVG is copied from
 * src/components/Logo/Logo.tsx on purpose (separate ownership, no Tailwind in
 * the admin bundle). Keep the geometry in sync if the brand mark changes.
 */
export const Icon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="zap-icon"
    fill="none"
    height="100%"
    viewBox="0 -14 136 136"
    width="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      className="zap-icon__front"
      height="40"
      rx="20"
      strokeWidth="15"
      transform="translate(54,54) rotate(45)"
      width="80"
      x="-40"
      y="-20"
    />
    <rect
      className="zap-icon__back"
      height="40"
      rx="20"
      strokeWidth="15"
      transform="translate(82,54) rotate(-45)"
      width="80"
      x="-40"
      y="-20"
    />
  </svg>
)

export default Icon
