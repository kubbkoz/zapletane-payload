/**
 * ZAPLETANE contact / brand facts.
 *
 * Ported from the Nuxt app's `app.config.ts` (`contact` block) — the single
 * place the header TopBar, the footer and the pre-launch page read the phone
 * number and e-mail from, so a change lands everywhere at once.
 * See DESIGN-SPEC.md §7.
 */
export const CONTACT = {
  brandName: 'Zapletane',
  domain: 'zapletane.sk',
  phone: {
    display: '+421 915 675 870',
    href: 'tel:+421915675870',
  },
  email: {
    info: 'info@zapletane.sk',
    href: 'mailto:info@zapletane.sk',
  },
  social: {
    facebook: '#',
    instagram: 'https://instagram.com/zapletane',
    youtube: '#',
  },
} as const
