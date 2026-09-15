import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { revalidateTag } from 'next/cache'

import { adminOnly } from '@/access/adminOnly'

/**
 * Flush the shop's cached filter config (`getShopFilterConfig` in
 * src/components/shop-filters/data.ts caches under the 'product-filters' tag
 * with a 60s ceiling) the moment a filter is saved or deleted, so admin edits
 * show up on /shop immediately instead of after the ceiling. Mirrors the
 * globals' revalidateGlobalHook pattern; the try/catch covers non-request
 * scopes (seed scripts, migrations) where revalidateTag throws.
 */
const revalidateProductFilters: CollectionAfterChangeHook = ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) {
    try {
      revalidateTag('product-filters', 'max')
      payload.logger.info('Revalidated product filters')
    } catch (err) {
      payload.logger.warn({ err }, 'Could not revalidate the product-filters cache tag')
    }
  }
  return doc
}

const revalidateProductFiltersOnDelete: CollectionAfterDeleteHook = ({
  doc,
  req: { context, payload },
}) => {
  if (!context.disableRevalidate) {
    try {
      revalidateTag('product-filters', 'max')
      payload.logger.info('Revalidated product filters (delete)')
    } catch (err) {
      payload.logger.warn({ err }, 'Could not revalidate the product-filters cache tag')
    }
  }
  return doc
}

/**
 * Filtre v obchode — admin-defined filter panels for /shop (X1).
 *
 * This collection is the *schema* half of the custom-filter feature: it says
 * which filters exist, in what order and what they offer. Rendering them is a
 * later wave's job (X4) — nothing in the storefront reads this collection yet.
 *
 * `type` decides which of the two option sources matters:
 *   - `tags`         -> `options` (label + value); a product matches when its
 *                       `filterTags` array contains the option's value
 *   - `categories`   -> `categories` (a subset of the taxonomy to offer)
 *   - `price`        -> no options; the min/max range filter
 *   - `availability` -> no options; skladom / na objednávku
 *
 * Read access is public: the shop page is a server component, but it renders
 * for guests and the filter definitions are not secret.
 */
export const ProductFilters: CollectionConfig = {
  slug: 'product-filters',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    afterChange: [revalidateProductFilters],
    afterDelete: [revalidateProductFiltersOnDelete],
  },
  admin: {
    defaultColumns: ['label', 'slug', 'type', 'enabled', 'sortOrder'],
    description:
      'Filtre zobrazené na stránke obchodu. Štítkové filtre sa párujú s poľom „Filtrovacie štítky“ na produkte.',
    group: 'Ecommerce',
    useAsTitle: 'label',
  },
  defaultSort: 'sortOrder',
  labels: {
    plural: 'Filtre v obchode',
    singular: 'Filter v obchode',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Názov',
          required: true,
          admin: {
            description: 'Nadpis filtra v paneli, napr. „Materiál“.',
            width: '50%',
          },
        },
        {
          name: 'slug',
          type: 'text',
          label: 'Identifikátor (slug)',
          required: true,
          unique: true,
          index: true,
          admin: {
            description:
              'Malé písmená a pomlčky, napr. „material“. Používa sa ako parameter v URL obchodu.',
            width: '50%',
          },
          hooks: {
            // Kebab-cased on the way in so the value is always URL-safe, no
            // matter whether it came from the admin UI, the REST API or MCP.
            beforeValidate: [
              ({ value }) =>
                typeof value === 'string'
                  ? value
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                  : value,
            ],
          },
        },
      ],
    },
    {
      name: 'type',
      type: 'select',
      label: 'Typ filtra',
      required: true,
      defaultValue: 'tags',
      options: [
        { label: 'Štítky', value: 'tags' },
        { label: 'Kategórie', value: 'categories' },
        { label: 'Cena', value: 'price' },
        { label: 'Dostupnosť', value: 'availability' },
      ],
      admin: {
        description:
          'Štítky = vlastné možnosti nižšie. Kategórie = výber z taxonómie. Cena a Dostupnosť nemajú možnosti.',
      },
    },
    {
      name: 'options',
      type: 'array',
      label: 'Možnosti filtra',
      labels: { plural: 'Možnosti', singular: 'Možnosť' },
      admin: {
        condition: (data) => data?.type === 'tags',
        description:
          'Jedna možnosť = jeden štítok. Hodnota sa musí zhodovať so štítkom zadaným na produkte („Filtrovacie štítky“).',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Názov možnosti',
              required: true,
              admin: { width: '50%' },
            },
            {
              name: 'value',
              type: 'text',
              label: 'Štítok (hodnota)',
              required: true,
              admin: {
                description: 'Napr. „vlna“. Presne toto sa zadáva na produkte.',
                width: '50%',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      label: 'Kategórie',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        condition: (data) => data?.type === 'categories',
        description: 'Prázdne = ponúknu sa všetky kategórie.',
        sortOptions: 'title',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Aktívny',
      defaultValue: true,
      admin: {
        description: 'Vypnutý filter sa v obchode nezobrazí.',
        position: 'sidebar',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Poradie',
      defaultValue: 0,
      admin: {
        description: 'Nižšie číslo = vyššie v paneli filtrov.',
        position: 'sidebar',
      },
    },
  ],
}
