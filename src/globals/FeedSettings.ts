import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { revalidateFeedsTag } from '@/lib/feeds/cache'

import { globalCacheTag, revalidateGlobalHook } from './revalidateGlobal'

/**
 * Cache tag the feed reader uses (`global_feed-settings`), same convention as
 * every other global in this project — see `src/utilities/getGlobals.ts`.
 */
export const FEED_SETTINGS_TAG = globalCacheTag('feed-settings')

/**
 * Curated list of feed attributes the owner may map a product field onto.
 *
 * Values are the *literal* element names emitted into the Google/Meta XML
 * (`<g:material>…`), which keeps the admin form honest: what you pick is what
 * the crawler sees. `custom` is the escape hatch — it renders whatever is typed
 * into `customAttribute` instead.
 *
 * Only attributes that (a) Google Merchant accepts and (b) can be filled from
 * data this shop actually has are listed. Everything Google requires
 * unconditionally (id/title/description/link/image_link/availability/price)
 * is produced by the feed itself and is deliberately NOT mappable.
 */
const FEED_ATTRIBUTE_OPTIONS = [
  { label: 'g:material — Materiál', value: 'g:material' },
  { label: 'g:color — Farba', value: 'g:color' },
  { label: 'g:size — Veľkosť', value: 'g:size' },
  { label: 'g:pattern — Vzor', value: 'g:pattern' },
  { label: 'g:age_group — Veková skupina', value: 'g:age_group' },
  { label: 'g:gender — Pohlavie', value: 'g:gender' },
  { label: 'g:custom_label_0 — Vlastný štítok 0', value: 'g:custom_label_0' },
  { label: 'g:custom_label_1 — Vlastný štítok 1', value: 'g:custom_label_1' },
  { label: 'g:custom_label_2 — Vlastný štítok 2', value: 'g:custom_label_2' },
  { label: 'g:custom_label_3 — Vlastný štítok 3', value: 'g:custom_label_3' },
  { label: 'g:custom_label_4 — Vlastný štítok 4', value: 'g:custom_label_4' },
  { label: 'g:product_length — Dĺžka produktu', value: 'g:product_length' },
  { label: 'g:product_width — Šírka produktu', value: 'g:product_width' },
  { label: 'g:product_height — Výška produktu', value: 'g:product_height' },
  { label: 'g:product_weight — Hmotnosť produktu', value: 'g:product_weight' },
  { label: 'g:mpn — Výrobné číslo (MPN)', value: 'g:mpn' },
  { label: 'g:gtin — Čiarový kód (GTIN/EAN)', value: 'g:gtin' },
  { label: 'Vlastný atribút (napíšem názov sám)', value: 'custom' },
]

/**
 * Where the value for a mapped attribute comes from.
 *
 * `dimensions.*` sources are formatted with their unit by the feed builder
 * (cm for the three lengths, g for the weight) because Google requires a
 * unit on every dimensional attribute — the admin never types it.
 */
const FEED_SOURCE_OPTIONS = [
  { label: 'Vlastnosť produktu', value: 'property' },
  { label: 'Rozmer — šírka (cm)', value: 'dimensions.width' },
  { label: 'Rozmer — výška (cm)', value: 'dimensions.height' },
  { label: 'Rozmer — hĺbka (cm)', value: 'dimensions.depth' },
  { label: 'Hmotnosť (g)', value: 'dimensions.weight' },
  { label: 'Filtrovacie štítky produktu', value: 'filterTags' },
  { label: 'Statická hodnota (rovnaká pre všetky produkty)', value: 'static' },
]

/**
 * Saving the feed settings must purge two different caches:
 *
 *   - `global_feed-settings` — the global's own cached read, same as every
 *     other global.
 *   - `feeds` — the rendered feed bodies. The defaults and the attribute
 *     mappings are baked into them, so a mapping change that did not purge the
 *     feeds would only show up an hour later.
 */
const revalidateFeedSettings: GlobalAfterChangeHook = (args) => {
  revalidateGlobalHook('feed-settings', 'nastavenia produktových feedov')(args)

  if (!args.req.context.disableRevalidate) {
    revalidateFeedsTag(args.req.payload)
  }

  return args.doc
}

/**
 * Produktové feedy (Y2) — the owner-facing configuration behind
 * `/feeds/google-merchant.xml`, `/feeds/meta-catalog.xml` and
 * `/feeds/meta-catalog.csv`.
 *
 * `enabled` defaults to FALSE on purpose: a feed is a public, uncredentialed
 * dump of the whole catalog, so it stays a 404 until the shop owner switches it
 * on deliberately.
 */
export const FeedSettings: GlobalConfig = {
  slug: 'feed-settings',
  label: 'Produktové feedy',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    description:
      'Nastavenia exportov katalógu pre Google Merchant Center a Meta (Facebook/Instagram) katalóg. Feedy: /feeds/google-merchant.xml, /feeds/meta-catalog.xml, /feeds/meta-catalog.csv. Aktualizujú sa automaticky pri každej zmene produktu (najneskôr do hodiny).',
  },
  hooks: {
    afterChange: [revalidateFeedSettings],
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Feedy sú zapnuté',
      admin: {
        description:
          'VYPNUTÉ = všetky tri adresy feedov vrátia 404. Feed je verejný a bez hesla — obsahuje celý publikovaný katalóg s cenami, preto sa zapína vedome.',
      },
    },
    {
      name: 'defaults',
      type: 'group',
      label: 'Predvolené hodnoty pre všetky produkty',
      admin: {
        description:
          'Hodnoty, ktoré sa do feedu zapíšu ku každému produktu rovnako. Značka a stav sú pre Google povinné.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'brand',
              type: 'text',
              defaultValue: 'ZAPLETANE',
              label: 'Značka (brand)',
              admin: {
                description: 'Povinný údaj pre Google Merchant Center.',
                width: '50%',
              },
            },
            {
              name: 'condition',
              type: 'select',
              defaultValue: 'new',
              label: 'Stav tovaru (condition)',
              options: [
                { label: 'Nový', value: 'new' },
                { label: 'Repasovaný', value: 'refurbished' },
                { label: 'Použitý', value: 'used' },
              ],
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'googleProductCategory',
          type: 'text',
          label: 'Kategória Google (google_product_category)',
          admin: {
            description:
              'ID alebo celá cesta z taxonómie Google, napr. „6552“ alebo „Home & Garden > Decor > Baskets“. Prázdne = atribút sa do feedu nezapíše a kategóriu si odvodí Google sám.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'shippingCountry',
              type: 'text',
              defaultValue: 'SK',
              label: 'Krajina doručenia (ISO kód)',
              admin: {
                description: 'Napr. SK. Používa sa v atribúte g:shipping.',
                width: '50%',
              },
            },
            {
              name: 'shippingPriceOverride',
              type: 'number',
              label: 'Cena dopravy vo feede (v centoch)',
              min: 0,
              admin: {
                description:
                  'Napr. 390 = 3,90 €. Prázdne = atribút g:shipping sa vôbec nezapíše a cenu dopravy si Google/Meta vypočíta z nastavení v ich rozhraní.',
                width: '50%',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'attributeMappings',
      type: 'array',
      label: 'Mapovanie atribútov',
      labels: { plural: 'Mapovania', singular: 'Mapovanie' },
      admin: {
        description:
          'Určuje, čo sa zapíše do nepovinných atribútov feedu. Jeden riadok = jeden atribút. Ak produkt zdrojovú hodnotu nemá, atribút sa pre daný produkt jednoducho vynechá.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'feedAttribute',
              type: 'select',
              label: 'Atribút vo feede',
              required: true,
              options: FEED_ATTRIBUTE_OPTIONS,
              admin: {
                description: 'Názov poľa tak, ako ho očakáva Google/Meta.',
                width: '50%',
              },
            },
            {
              name: 'source',
              type: 'select',
              label: 'Zdroj hodnoty',
              required: true,
              options: FEED_SOURCE_OPTIONS,
              admin: {
                description: 'Odkiaľ sa hodnota pre každý produkt načíta.',
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'customAttribute',
          type: 'text',
          label: 'Názov vlastného atribútu',
          admin: {
            condition: (_data, siblingData) => siblingData?.feedAttribute === 'custom',
            description:
              'Napr. „g:size_type“. Zapíše sa presne takto, vrátane predpony g:. Povolené sú len písmená, číslice, dvojbodka a podtržník.',
          },
        },
        {
          name: 'property',
          type: 'relationship',
          label: 'Vlastnosť produktu',
          relationTo: 'product-properties',
          admin: {
            condition: (_data, siblingData) => siblingData?.source === 'property',
            description:
              'Napr. „Materiál“. Hodnota sa berie z produktu — z tabuľky vlastností na záložke „Vlastnosti“. Jednotka vlastnosti (ak je zadaná) sa pripojí za hodnotu.',
            sortOptions: 'name',
          },
        },
        {
          name: 'staticValue',
          type: 'text',
          label: 'Statická hodnota',
          admin: {
            condition: (_data, siblingData) => siblingData?.source === 'static',
            description: 'Zapíše sa ku každému produktu rovnaká, napr. „unisex“ alebo „adult“.',
          },
        },
      ],
    },
  ],
}
