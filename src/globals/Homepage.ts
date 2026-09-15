import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { CONTENT_ICON_OPTIONS } from '@/lib/contentIcons'
import { homepageDefaultData } from '@/lib/homeDefaults'

import { globalCacheTag, revalidateGlobalHook } from './revalidateGlobal'

/**
 * One shared mapping of the baked constants onto this global's data shape —
 * also used by the dev seed and the production content-defaults migration, so
 * the three can never disagree.
 */
const DEFAULTS = homepageDefaultData()

/** Cache tag the homepage reads under — see `getHomepage`. */
export const HOMEPAGE_TAG = globalCacheTag('homepage')

/**
 * Everything the ZAPLETANE homepage used to hard-code.
 *
 * Every field's `defaultValue` is the exact value the component rendered
 * before, taken from `src/lib/homeDefaults.ts`. `findGlobal` returns those
 * defaults for a database where this global has never been saved, and
 * `src/lib/homeContent.ts` falls back to the same constants field by field —
 * so deploying this changes nothing on screen until somebody edits something.
 *
 * Images are an upload relationship to `media` *with* a static-path fallback:
 * the seeded defaults point at the pre-compressed WebP shots that already ship
 * in /public, and uploading a media item simply takes precedence.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Domovská stránka',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    description:
      'Obsah domovskej stránky: hero slider, slogan, sekcia „Prečo Zapletane", záložky produktov, sortiment a darčekový banner.',
  },
  hooks: {
    afterChange: [revalidateGlobalHook('homepage', 'homepage content')],
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      label: 'Hero (úvodný slider)',
      fields: [
        {
          name: 'slides',
          type: 'array',
          label: 'Snímky',
          labels: { plural: 'Snímky', singular: 'Snímka' },
          defaultValue: DEFAULTS.hero.slides,
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: 'Obrázok',
              admin: {
                description:
                  'Nahraný obrázok má prednosť. Ak nie je nahraný, použije sa statická cesta nižšie.',
              },
            },
            {
              name: 'imageUrl',
              type: 'text',
              label: 'Statická cesta k obrázku (záloha)',
              admin: {
                description: 'Napr. /assets/images/hero/hero-kolekcia.webp',
              },
            },
            {
              name: 'mediaType',
              type: 'select',
              label: 'Pozadie hera',
              defaultValue: 'image',
              options: [
                { label: 'Obrázok', value: 'image' },
                { label: 'Video', value: 'video' },
              ],
              admin: {
                description:
                  'Pri voľbe „Video“ sa namiesto fotky prehrá video. Obrázok vyššie zostáva ako záloha, keď video chýba alebo návštevník má zapnuté obmedzenie pohybu.',
              },
            },
            {
              name: 'video',
              type: 'upload',
              relationTo: 'media',
              label: 'Video',
              admin: {
                condition: (_data, siblingData) => siblingData?.mediaType === 'video',
                description:
                  'Krátke video do ~20 s, ideálne bez zvuku — zvuková stopa sa pri nahraní aj tak odstráni a video sa prehráva stlmené. Nahrané video sa automaticky skomprimuje na MP4 (H.264, max 1920 px). Väčšie súbory nahrávajte už skomprimované, do ~4 MB: produkčný server (Vercel) väčšie telo požiadavky odmietne.',
              },
            },
            {
              name: 'videoPoster',
              type: 'upload',
              relationTo: 'media',
              label: 'Náhľadový obrázok videa',
              admin: {
                condition: (_data, siblingData) => siblingData?.mediaType === 'video',
                description:
                  'Zobrazí sa, kým sa video načíta, a nahradí video pri zapnutom obmedzení pohybu (šetrenie dát a pohybová citlivosť). Keď je prázdny, použije sa obrázok snímky.',
              },
            },
            {
              name: 'eyebrow',
              type: 'text',
              label: 'Eyebrow (malý štítok nad nadpisom)',
            },
            {
              name: 'title',
              type: 'textarea',
              label: 'Nadpis',
            },
            {
              name: 'text',
              type: 'textarea',
              label: 'Text pod nadpisom',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'ctaLabel',
                  type: 'text',
                  label: 'Text tlačidla',
                  admin: { width: '50%' },
                },
                {
                  name: 'ctaHref',
                  type: 'text',
                  label: 'Odkaz tlačidla',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'secondaryCtaLabel',
                  type: 'text',
                  label: 'Text sekundárneho odkazu (voliteľné)',
                  admin: { width: '50%' },
                },
                {
                  name: 'secondaryCtaHref',
                  type: 'text',
                  label: 'Sekundárny odkaz',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'hotspots',
              type: 'array',
              label: 'Body na fotke (hotspoty)',
              labels: { plural: 'Hotspoty', singular: 'Hotspot' },
              admin: {
                description:
                  'Zobrazujú sa iba na veľkých obrazovkách. X/Y sú percentá od ľavého horného rohu fotky.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'x',
                      type: 'number',
                      label: 'X (%)',
                      max: 100,
                      min: 0,
                      admin: { width: '50%' },
                    },
                    {
                      name: 'y',
                      type: 'number',
                      label: 'Y (%)',
                      max: 100,
                      min: 0,
                      admin: { width: '50%' },
                    },
                  ],
                },
                {
                  name: 'label',
                  type: 'text',
                  label: 'Názov produktu',
                },
                {
                  name: 'price',
                  type: 'text',
                  label: 'Cena (text, napr. „99,00 €")',
                },
                {
                  name: 'product',
                  type: 'relationship',
                  relationTo: 'products',
                  label: 'Produkt (odkaz)',
                  admin: {
                    description: 'Ak je vyplnený, tlačidlo „Viac info" vedie na detail produktu.',
                  },
                },
                {
                  name: 'href',
                  type: 'text',
                  label: 'Vlastný odkaz (ak nie je vybraný produkt)',
                },
              ],
            },
          ],
        },
        {
          name: 'perks',
          type: 'array',
          label: 'Piliere pod tlačidlom',
          labels: { plural: 'Piliere', singular: 'Pilier' },
          defaultValue: DEFAULTS.hero.perks,
          maxRows: 4,
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'icon',
                  type: 'select',
                  label: 'Ikona',
                  options: CONTENT_ICON_OPTIONS,
                  admin: { width: '50%' },
                },
                {
                  name: 'label',
                  type: 'text',
                  label: 'Popis',
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'slogan',
      type: 'group',
      label: 'Slogan',
      admin: {
        description: 'Zloží sa ako „text pred · zvýraznené slovo · text za", oddelené medzerou.',
      },
      fields: [
        {
          name: 'before',
          type: 'text',
          defaultValue: DEFAULTS.slogan.before,
          label: 'Text pred zvýraznením',
        },
        {
          name: 'highlight',
          type: 'text',
          defaultValue: DEFAULTS.slogan.highlight,
          label: 'Zvýraznené slovo',
        },
        {
          name: 'after',
          type: 'text',
          defaultValue: DEFAULTS.slogan.after,
          label: 'Text za zvýraznením',
        },
      ],
    },
    {
      name: 'features',
      type: 'group',
      label: 'Prečo Zapletane',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: DEFAULTS.features.eyebrow,
          label: 'Eyebrow',
        },
        {
          name: 'heading',
          type: 'textarea',
          defaultValue: DEFAULTS.features.heading,
          label: 'Nadpis',
          admin: { description: 'Zalomenie riadku v tomto poli sa vykreslí ako <br>.' },
        },
        {
          name: 'text',
          type: 'textarea',
          defaultValue: DEFAULTS.features.text,
          label: 'Odstavec vpravo',
        },
        {
          name: 'cards',
          type: 'array',
          label: 'Karty',
          labels: { plural: 'Karty', singular: 'Karta' },
          defaultValue: DEFAULTS.features.cards,
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'icon',
                  type: 'select',
                  label: 'Ikona',
                  options: CONTENT_ICON_OPTIONS,
                  admin: { width: '50%' },
                },
                {
                  name: 'title',
                  type: 'text',
                  label: 'Nadpis karty',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'text',
              type: 'textarea',
              label: 'Text karty',
            },
          ],
        },
      ],
    },
    {
      name: 'productTabs',
      type: 'group',
      label: 'Záložky produktov',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: DEFAULTS.productTabs.eyebrow,
          label: 'Eyebrow',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'titleBefore',
              type: 'text',
              defaultValue: DEFAULTS.productTabs.titleBefore,
              label: 'Nadpis — text pred',
              admin: { width: '50%' },
            },
            {
              name: 'titleHighlight',
              type: 'text',
              defaultValue: DEFAULTS.productTabs.titleHighlight,
              label: 'Nadpis — zvýraznené slovo',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'tabs',
          type: 'array',
          label: 'Záložky',
          labels: { plural: 'Záložky', singular: 'Záložka' },
          defaultValue: DEFAULTS.productTabs.tabs,
          maxRows: 5,
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  label: 'Popis záložky',
                  admin: { width: '50%' },
                },
                {
                  name: 'sort',
                  type: 'select',
                  defaultValue: '-createdAt',
                  label: 'Zoradenie produktov',
                  options: [
                    { label: 'Najnovšie', value: '-createdAt' },
                    { label: 'Abecedne A–Z', value: 'title' },
                    { label: 'Cena: od najnižšej', value: 'priceInEUR' },
                    { label: 'Cena: od najvyššej', value: '-priceInEUR' },
                  ],
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: true,
              label: 'Zobraziť',
            },
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'group',
      label: 'Sortiment (kategórie)',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: DEFAULTS.categories.eyebrow,
          label: 'Eyebrow',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'titleLine',
              type: 'text',
              defaultValue: DEFAULTS.categories.titleLine,
              label: 'Nadpis — prvý riadok',
              admin: { width: '50%' },
            },
            {
              name: 'titleHighlight',
              type: 'text',
              defaultValue: DEFAULTS.categories.titleHighlight,
              label: 'Nadpis — druhý riadok (zvýraznený)',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'text',
          type: 'textarea',
          defaultValue: DEFAULTS.categories.text,
          label: 'Text',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ctaLabel',
              type: 'text',
              defaultValue: DEFAULTS.categories.ctaLabel,
              label: 'Text tlačidla',
              admin: { width: '50%' },
            },
            {
              name: 'ctaHref',
              type: 'text',
              defaultValue: DEFAULTS.categories.ctaHref,
              label: 'Odkaz tlačidla',
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      name: 'giftCta',
      type: 'group',
      label: 'Darčekový banner',
      fields: [
        {
          name: 'title',
          type: 'text',
          defaultValue: DEFAULTS.giftCta.title,
          label: 'Nadpis',
        },
        {
          name: 'text',
          type: 'textarea',
          defaultValue: DEFAULTS.giftCta.text,
          label: 'Text',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ctaLabel',
              type: 'text',
              defaultValue: DEFAULTS.giftCta.ctaLabel,
              label: 'Text tlačidla',
              admin: { width: '50%' },
            },
            {
              name: 'ctaHref',
              type: 'text',
              defaultValue: DEFAULTS.giftCta.ctaHref,
              label: 'Odkaz tlačidla',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Obrázok',
          admin: {
            description:
              'Nahraný obrázok má prednosť. Ak nie je nahraný, použije sa statická cesta nižšie.',
          },
        },
        {
          name: 'imageUrl',
          type: 'text',
          defaultValue: DEFAULTS.giftCta.imageUrl,
          label: 'Statická cesta k obrázku (záloha)',
        },
      ],
    },
  ],
}
