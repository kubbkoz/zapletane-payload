import type { Footer } from '@/payload-types'

/**
 * Footer copy defaults — the strings `src/components/Footer` used to hard-code.
 *
 * Same two-sided contract as the homepage: `src/globals/Footer.ts` seeds these
 * through `defaultValue` (so an unsaved global returns them from `findGlobal`),
 * and `resolveFooterContent` below falls back to them field by field (so a
 * footer row saved before these fields existed still renders the original
 * copy).
 */
export const FOOTER_DEFAULTS = {
  description:
    'U nás nájdete ručne pletené deky a hračky, prútené dekorácie aj doplnky do domácnosti. Každý kúsok vzniká s láskou a trpezlivosťou.',
  navTitle: 'Kategórie',
  contact: {
    heading: 'Kontakt',
    phoneLabel: 'Infolinka',
    emailLabel: 'Email',
    returnsLabel: 'Reklamácia / Vrátenie',
    returnsLinkLabel: 'Vyplniť formulár',
    returnsHref: '/odstupenie-od-zmluvy',
    showBusinessDetails: false,
  },
  support: {
    heading: 'Zákaznícka podpora',
    text: 'Sme tu pre vás každý pracovný deň a radi poradíme s výberom toho pravého.',
  },
  bottomBar: {
    copyright: '© {{year}} Zapletane. Všetky práva vyhradené.',
    cookieButtonLabel: 'Nastavenia cookies',
  },
} as const

export type FooterContent = {
  description: string
  navTitle: string
  contact: {
    heading: string
    phoneLabel: string
    emailLabel: string
    returnsLabel: string
    returnsLinkLabel: string
    returnsHref: string
    showBusinessDetails: boolean
  }
  support: { heading: string; text: string }
  bottomBar: { copyright: string; cookieButtonLabel: string }
}

/** `''` and `null` both mean "not set" for a CMS text field. */
const pick = (value: null | string | undefined, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value : fallback

export function resolveFooterContent(footer?: Footer | null): FooterContent {
  return {
    description: pick(footer?.description, FOOTER_DEFAULTS.description),
    navTitle: pick(footer?.navTitle, FOOTER_DEFAULTS.navTitle),
    contact: {
      heading: pick(footer?.contact?.heading, FOOTER_DEFAULTS.contact.heading),
      phoneLabel: pick(footer?.contact?.phoneLabel, FOOTER_DEFAULTS.contact.phoneLabel),
      emailLabel: pick(footer?.contact?.emailLabel, FOOTER_DEFAULTS.contact.emailLabel),
      returnsLabel: pick(footer?.contact?.returnsLabel, FOOTER_DEFAULTS.contact.returnsLabel),
      returnsLinkLabel: pick(
        footer?.contact?.returnsLinkLabel,
        FOOTER_DEFAULTS.contact.returnsLinkLabel,
      ),
      returnsHref: pick(footer?.contact?.returnsHref, FOOTER_DEFAULTS.contact.returnsHref),
      showBusinessDetails: Boolean(footer?.contact?.showBusinessDetails),
    },
    support: {
      heading: pick(footer?.support?.heading, FOOTER_DEFAULTS.support.heading),
      text: pick(footer?.support?.text, FOOTER_DEFAULTS.support.text),
    },
    bottomBar: {
      copyright: pick(footer?.bottomBar?.copyright, FOOTER_DEFAULTS.bottomBar.copyright),
      cookieButtonLabel: pick(
        footer?.bottomBar?.cookieButtonLabel,
        FOOTER_DEFAULTS.bottomBar.cookieButtonLabel,
      ),
    },
  }
}

/** `{{year}}` → the current year, evaluated at render time. */
export const renderCopyright = (template: string): string =>
  template.replace(/\{\{\s*year\s*\}\}/gi, String(new Date().getFullYear()))
