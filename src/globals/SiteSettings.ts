import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { COMING_SOON_COPY } from '@/components/ComingSoon/copy'
import { CONTACT } from '@/lib/contact'

import { globalCacheTag, revalidateGlobalHook } from './revalidateGlobal'

/**
 * Cache tag the storefront gate reads under (see `getSiteSettings`). Kept in
 * sync with `getCachedGlobal`'s `global_<slug>` convention so a manual
 * `revalidateTag` here and the generic helper never drift apart.
 */
export const SITE_SETTINGS_TAG = globalCacheTag('site-settings')

/**
 * Flush the cached copy the moment someone saves — from the admin UI, the REST
 * API or an MCP client. The 30s `revalidate` on the cached read is only the
 * safety net for the cases where this hook cannot run (a direct DB write, or a
 * revalidation outside a Next request scope: seed scripts, migrations, a
 * standalone `payload` CLI run).
 */
const revalidateSiteSettings = revalidateGlobalHook(
  'site-settings',
  'site settings (pre-launch gate + contact details)',
)

/**
 * Site-wide switches that are not part of any single page's content.
 *
 * Today that is the pre-launch ("coming soon") gate, which replaces the Nuxt
 * app's file/Redis-backed Nitro toggle (`server/utils/coming-soon-state.ts`)
 * with a Payload global, so it can be flipped from the admin UI or over MCP
 * with no deploy. `comingSoonEnabled` defaults to TRUE: a fresh deploy — one
 * with no row in this table at all — launches gated, exactly like the original
 * baked `COMING_SOON` default.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Nastavenia webu',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    description:
      'Prepínač režimu webu a obsah predspúšťacej stránky. Administrácia (/admin) funguje v každom režime.',
  },
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
  fields: [
    {
      name: 'comingSoonEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Režim webu — Coming soon / Produkcia',
      admin: {
        description:
          'ZAPNUTÉ = Coming soon: návštevníci vidia predspúšťaciu stránku „Čoskoro spúšťame". VYPNUTÉ = Produkcia: plný e-shop. Náhľad produkcie počas Coming soon: ?preview=<COMING_SOON_BYPASS>. Zmena sa prejaví do minúty.',
      },
    },
    {
      name: 'comingSoon',
      type: 'group',
      label: 'Obsah Coming soon stránky',
      admin: {
        description: 'Texty predspúšťacej stránky. Prázdne pole = predvolený text.',
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: COMING_SOON_COPY.eyebrow,
          label: 'Eyebrow',
        },
        {
          name: 'title',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.title,
          label: 'Headline',
          admin: {
            description: 'A line break in this field becomes a <br> in the headline.',
          },
        },
        {
          name: 'body',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.body,
          label: 'Lede (also used as the meta description / OG description)',
        },
        {
          name: 'note',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.note,
          label: 'Note',
        },
        {
          name: 'phone',
          type: 'text',
          defaultValue: CONTACT.phone.display,
          label: 'Phone (primary contact button)',
        },
        {
          name: 'email',
          type: 'text',
          defaultValue: CONTACT.email.info,
          label: 'E-mail (secondary contact button)',
        },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      label: 'Kontaktné údaje',
      admin: {
        description:
          'Jediný zdroj pravdy pre telefón, e-mail a fakturačné údaje — číta ich horná lišta, mobilné menu aj pätička. Prázdne pole = pôvodná predvolená hodnota.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'phone',
              type: 'text',
              defaultValue: CONTACT.phone.display,
              label: 'Telefón',
              admin: { width: '50%' },
            },
            {
              name: 'email',
              type: 'text',
              defaultValue: CONTACT.email.info,
              label: 'E-mail',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'companyName',
          type: 'text',
          defaultValue: CONTACT.brandName,
          label: 'Obchodné meno',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ico',
              type: 'text',
              label: 'IČO',
              admin: { width: '33%' },
            },
            {
              name: 'dic',
              type: 'text',
              label: 'DIČ',
              admin: { width: '33%' },
            },
            {
              name: 'icDph',
              type: 'text',
              label: 'IČ DPH',
              admin: { width: '33%' },
            },
          ],
        },
        {
          name: 'address',
          type: 'textarea',
          label: 'Adresa',
          admin: { description: 'Zalomenie riadku sa vykreslí ako nový riadok.' },
        },
        {
          name: 'openingHours',
          type: 'textarea',
          label: 'Otváracie hodiny',
        },
      ],
    },
    {
      name: 'payments',
      type: 'group',
      label: 'Platobné údaje',
      admin: {
        description:
          'Bankové spojenie pre platbu prevodom. Zobrazí sa zákazníkovi na potvrdení objednávky spolu so sumou a variabilným symbolom.',
      },
      fields: [
        {
          name: 'bankAccountHolder',
          type: 'text',
          defaultValue: 'ZAPLETANE',
          label: 'Majiteľ účtu',
        },
        {
          name: 'iban',
          type: 'text',
          label: 'IBAN',
          admin: {
            description: 'Napr. SK00 0000 0000 0000 0000 0000. Prázdne = pokyny sa nezobrazia.',
          },
        },
        {
          name: 'swift',
          type: 'text',
          label: 'SWIFT / BIC',
        },
        {
          name: 'bankName',
          type: 'text',
          label: 'Názov banky',
        },
        {
          name: 'variableSymbolNote',
          type: 'textarea',
          defaultValue:
            'Ako variabilný symbol uveďte číslo objednávky. Tovar expedujeme po pripísaní platby na účet.',
          label: 'Poznámka k variabilnému symbolu',
          admin: {
            description:
              'Vysvetlivka pod platobnými údajmi. Samotný variabilný symbol = číslo objednávky, dopĺňa sa automaticky.',
          },
        },
      ],
    },
  ],
}
