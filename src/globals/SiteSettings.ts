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
    // --- Vyhľadávanie (X1) -------------------------------------------------
    // Schema + defaults only. Every default below is exactly what the search UI
    // does today (placeholder copy, 2-character minimum, title+description
    // matching, 12 results per page), so saving this global changes nothing
    // until the search wave (X4) starts reading it.
    {
      name: 'search',
      type: 'group',
      label: 'Vyhľadávanie',
      admin: {
        description:
          'Správanie vyhľadávania v obchode. Predvolené hodnoty zodpovedajú súčasnému stavu — meniť ich treba len pri zmene požiadaviek.',
      },
      fields: [
        {
          name: 'placeholder',
          type: 'text',
          defaultValue: 'Hľadať produkty…',
          label: 'Text v poli vyhľadávania',
          admin: {
            description: 'Napovedajúci text (placeholder) v prázdnom vyhľadávacom poli.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'minChars',
              type: 'number',
              defaultValue: 2,
              min: 1,
              max: 10,
              label: 'Minimálny počet znakov',
              admin: {
                description: 'Pod týmto počtom znakov sa vyhľadávanie nespustí.',
                width: '50%',
              },
            },
            {
              name: 'resultsPerPage',
              type: 'number',
              defaultValue: 12,
              min: 1,
              max: 96,
              label: 'Počet výsledkov na stránku',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'searchFields',
          type: 'select',
          hasMany: true,
          defaultValue: ['title', 'description'],
          label: 'Prehľadávané polia',
          options: [
            { label: 'Názov produktu', value: 'title' },
            { label: 'Popis', value: 'description' },
            { label: 'Kategórie', value: 'categories' },
          ],
          admin: {
            description: 'Ktoré časti produktu sa prehľadávajú. Aspoň jedno pole musí byť zvolené.',
          },
        },
        // Z1 — obsah mobilného vyhľadávacieho okna PRED zadaním hľadaného
        // výrazu. Obe polia sú nepovinné: prázdne pole = sekcia sa vôbec
        // nezobrazí a okno ukáže pôvodnú nápovedu.
        {
          name: 'recommendedProducts',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          label: 'Odporúčané produkty',
          admin: {
            description:
              'Produkty zobrazené vo vyhľadávacom okne ešte pred tým, než návštevník začne písať. Prázdne = sekcia „Odporúčané produkty" sa nezobrazí.',
          },
        },
        {
          name: 'recommendedCategories',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
          label: 'Odporúčané kategórie',
          admin: {
            description:
              'Kategórie zobrazené ako rýchle odkazy vo vyhľadávacom okne ešte pred tým, než návštevník začne písať. Prázdne = sekcia „Odporúčané kategórie" sa nezobrazí.',
          },
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
    // --- Marketing a meranie (Y2) -----------------------------------------
    // A deliberate trust boundary. Whatever is stored here is parsed into real
    // <script>/<noscript>/<meta>/<link> elements and rendered into every
    // storefront page, so it can do anything a first-party script can do. The
    // global's `update` access is `adminOnly` (see above) — that is the only
    // thing standing between this field and stored XSS, and it must stay that
    // way. See src/components/TrackingScripts for what is parsed and what is
    // ignored.
    {
      name: 'marketing',
      type: 'group',
      label: 'Marketing a meranie',
      admin: {
        description:
          'Kódy tretích strán (Meta Pixel, Google Tag Manager, Google Analytics, overenie vlastníctva domény). POZOR: obsah sa vloží do stránky doslovne a spustí sa v prehliadači každého návštevníka — vkladaj sem len kód z dôveryhodného zdroja. Polia smie meniť iba administrátor.',
      },
      fields: [
        {
          name: 'headScripts',
          type: 'textarea',
          label: 'Skripty v <head> — Meta Pixel, GTM, Google Analytics…',
          admin: {
            description:
              'Vlož celý úryvok aj so značkami <script>…</script>. Spracujú sa značky <script>, <noscript>, <meta> a <link>; ostatný text sa ignoruje. Prázdne = nič sa nevkladá.',
            rows: 10,
          },
        },
        {
          name: 'bodyStartScripts',
          type: 'textarea',
          label: 'Hneď za <body> — napr. GTM noscript',
          admin: {
            description:
              'Druhá časť kódu Google Tag Managera (<noscript> s iframe) patrí sem. Spracujú sa rovnaké značky ako vyššie.',
            rows: 6,
          },
        },
      ],
    },
  ],
}
