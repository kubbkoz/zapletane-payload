import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { link } from '@/fields/link'
import { FOOTER_DEFAULTS } from '@/lib/footerDefaults'
import { SOCIAL_LINKS, SOCIAL_PLATFORM_OPTIONS } from '@/lib/navigation'

import { globalCacheTag, revalidateGlobalHook } from './revalidateGlobal'

/** Cache tag the storefront footer reads under (see `getCachedGlobal`). */
export const FOOTER_TAG = globalCacheTag('footer')

/**
 * Everything the footer used to hard-code, plus the link column it already had.
 *
 * Defaults come from `src/lib/footerDefaults.ts`, the same constants
 * `src/components/Footer` falls back to — so a footer row saved before these
 * fields existed (all-null columns) renders exactly the original copy.
 *
 * Social links live here rather than in SiteSettings because the footer is
 * their primary home; the mobile menu renders the same list (passed down from
 * the header's server component) so editors only ever change them in one place.
 */
export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Pätička',
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    afterChange: [revalidateGlobalHook('footer', 'footer content')],
  },
  fields: [
    {
      name: 'description',
      type: 'textarea',
      defaultValue: FOOTER_DEFAULTS.description,
      label: 'Text pod logom',
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Sociálne siete',
      labels: { plural: 'Siete', singular: 'Sieť' },
      defaultValue: SOCIAL_LINKS.map((social) => ({
        platform: social.platform,
        url: social.url,
      })),
      maxRows: 6,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'platform',
              type: 'select',
              label: 'Sieť',
              options: SOCIAL_PLATFORM_OPTIONS,
              required: true,
              admin: { width: '50%' },
            },
            {
              name: 'url',
              type: 'text',
              label: 'URL',
              required: true,
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      name: 'navTitle',
      type: 'text',
      defaultValue: FOOTER_DEFAULTS.navTitle,
      label: 'Nadpis stĺpca s odkazmi',
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Odkazy v stĺpci',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
    {
      name: 'contact',
      type: 'group',
      label: 'Stĺpec Kontakt',
      admin: {
        description:
          'Telefón a e-mail sa berú z Nastavenia webu → Kontaktné údaje; tu sa nastavujú iba popisy a odkaz na reklamáciu.',
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
          defaultValue: FOOTER_DEFAULTS.contact.heading,
          label: 'Nadpis stĺpca',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'phoneLabel',
              type: 'text',
              defaultValue: FOOTER_DEFAULTS.contact.phoneLabel,
              label: 'Popis nad telefónom',
              admin: { width: '50%' },
            },
            {
              name: 'emailLabel',
              type: 'text',
              defaultValue: FOOTER_DEFAULTS.contact.emailLabel,
              label: 'Popis nad e-mailom',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'returnsLabel',
          type: 'text',
          defaultValue: FOOTER_DEFAULTS.contact.returnsLabel,
          label: 'Popis nad odkazom na reklamáciu',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'returnsLinkLabel',
              type: 'text',
              defaultValue: FOOTER_DEFAULTS.contact.returnsLinkLabel,
              label: 'Text odkazu',
              admin: { width: '50%' },
            },
            {
              name: 'returnsHref',
              type: 'text',
              defaultValue: FOOTER_DEFAULTS.contact.returnsHref,
              label: 'Cieľ odkazu',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'showBusinessDetails',
          type: 'checkbox',
          defaultValue: false,
          label: 'Zobraziť IČO / DIČ a adresu (z Nastavení webu)',
        },
      ],
    },
    {
      name: 'support',
      type: 'group',
      label: 'Stĺpec Zákaznícka podpora',
      fields: [
        {
          name: 'heading',
          type: 'text',
          defaultValue: FOOTER_DEFAULTS.support.heading,
          label: 'Nadpis stĺpca',
        },
        {
          name: 'text',
          type: 'textarea',
          defaultValue: FOOTER_DEFAULTS.support.text,
          label: 'Text',
        },
      ],
    },
    {
      name: 'bottomBar',
      type: 'group',
      label: 'Spodná lišta',
      fields: [
        {
          name: 'copyright',
          type: 'text',
          defaultValue: FOOTER_DEFAULTS.bottomBar.copyright,
          label: 'Copyright',
          admin: {
            description: '{{year}} sa nahradí aktuálnym rokom.',
          },
        },
        {
          name: 'cookieButtonLabel',
          type: 'text',
          defaultValue: FOOTER_DEFAULTS.bottomBar.cookieButtonLabel,
          label: 'Text tlačidla nastavení cookies',
        },
      ],
    },
  ],
}
