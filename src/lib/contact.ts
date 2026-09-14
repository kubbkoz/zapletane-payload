import type { SiteSetting } from '@/payload-types'

/**
 * ZAPLETANE contact / brand facts.
 *
 * Ported from the Nuxt app's `app.config.ts` (`contact` block). These constants
 * are now the *fallback* layer only: the editable source of truth is the
 * `site-settings` global's `contact` group, which seeds exactly these values.
 * `resolveContact` merges the global over the constants field by field, so an
 * empty or never-saved global renders precisely what the storefront rendered
 * before the fields existed. See DESIGN-SPEC.md §7.
 *
 * Deliberately free of any Payload runtime import — `src/globals/SiteSettings.ts`
 * imports `CONTACT` for its own field defaults, so importing the config back
 * from here would be a cycle. The async reader lives in
 * `src/utilities/getContact.ts`.
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

export type ResolvedContact = {
  brandName: string
  domain: string
  phone: { display: string; href: string }
  email: { info: string; href: string }
  social: { facebook: string; instagram: string; youtube: string }
  /** Business details — no hard-coded predecessor, so null until an editor fills them in. */
  ico: null | string
  dic: null | string
  icDph: null | string
  address: null | string
  openingHours: null | string
}

const pick = (value: null | string | undefined, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback

const optional = (value: null | string | undefined): null | string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** `tel:` hrefs carry no spaces or formatting characters. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

export const mailHref = (email: string): string => `mailto:${email}`

/**
 * Merge the `site-settings` contact group over the baked constants.
 *
 * Pure and synchronous so client components can be handed the result as a prop
 * (the header does exactly that) and so it stays trivially testable.
 */
export function resolveContact(siteSettings?: null | SiteSetting): ResolvedContact {
  const contact = siteSettings?.contact
  const phone = pick(contact?.phone, CONTACT.phone.display)
  const email = pick(contact?.email, CONTACT.email.info)

  return {
    brandName: pick(contact?.companyName, CONTACT.brandName),
    domain: CONTACT.domain,
    phone: { display: phone, href: telHref(phone) },
    email: { info: email, href: mailHref(email) },
    social: { ...CONTACT.social },
    ico: optional(contact?.ico),
    dic: optional(contact?.dic),
    icDph: optional(contact?.icDph),
    address: optional(contact?.address),
    openingHours: optional(contact?.openingHours),
  }
}

/** The constants-only contact, for code paths with no database access. */
export const DEFAULT_CONTACT: ResolvedContact = resolveContact(null)
