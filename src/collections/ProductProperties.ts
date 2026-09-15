import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Vlastnosti — the shop-wide catalogue of product property definitions (Y1).
 *
 * This collection is the *dictionary* half of the product-properties feature:
 * it says which properties exist ("Materiál", "Farba", "Dĺžka"), how their
 * value should be read (`unit`) and which values are worth suggesting
 * (`predefinedValues`). The actual value of a property for a given product
 * lives on the product itself (`products.properties[].value`), so two products
 * can share the definition "Materiál" while saying "vlna" and "prútie".
 *
 * `predefinedValues` are deliberately *suggestions only* — nothing validates a
 * product's value against them. A one-off value ("100 % merino") must not
 * require an edit of the shared dictionary, and Y2's feed mapping reads the
 * stored string, not a whitelist.
 *
 * Read access is public: the storefront PDP (Y3) renders the property name and
 * unit next to the product's value from a server component that also serves
 * guests, and a property dictionary is not secret. Writes are admin-only.
 */
export const ProductProperties: CollectionConfig = {
  slug: 'product-properties',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'slug', 'unit', 'sortOrder'],
    description:
      'Zoznam vlastností, ktoré sa dajú vyplniť na produkte (napr. Materiál, Farba, Dĺžka). Hodnotu zadávaš na konkrétnom produkte v záložke „Vlastnosti“.',
    group: 'Ecommerce',
    useAsTitle: 'name',
  },
  defaultSort: 'sortOrder',
  labels: {
    plural: 'Vlastnosti',
    singular: 'Vlastnosť',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Názov',
          required: true,
          unique: true,
          index: true,
          admin: {
            description: 'Zobrazí sa na produkte aj v tabuľke vlastností, napr. „Materiál“.',
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
              'Malé písmená a pomlčky, napr. „material“. Prázdne = doplní sa automaticky z názvu. Používa sa v produktových feedoch a v URL.',
            width: '50%',
          },
          hooks: {
            // Kebab-cased on the way in — and derived from `name` when left
            // empty — so the value is always URL/feed-safe no matter whether it
            // arrived from the admin UI, the REST API, MCP or the seed script.
            beforeValidate: [
              ({ data, siblingData, value }) => {
                const source =
                  typeof value === 'string' && value.trim().length > 0
                    ? value
                    : ((siblingData as { name?: unknown })?.name ??
                      (data as { name?: unknown })?.name)

                if (typeof source !== 'string') return value

                return source
                  .trim()
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[̀-ͯ]/g, '')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
              },
            ],
          },
        },
      ],
    },
    {
      name: 'unit',
      type: 'text',
      label: 'Jednotka',
      admin: {
        description:
          'Voliteľné. Napr. „cm“ alebo „g“ — pripojí sa za hodnotu pri zobrazení. Prázdne = bez jednotky.',
      },
    },
    {
      name: 'predefinedValues',
      type: 'array',
      label: 'Predvolené hodnoty',
      labels: { plural: 'Hodnoty', singular: 'Hodnota' },
      admin: {
        description:
          'Voliteľný zoznam návrhov (napr. vlna, bavlna, prútie). Na produkte sa dá zadať aj iná hodnota — nič sa nevynucuje.',
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Hodnota',
          required: true,
        },
      ],
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Poradie',
      defaultValue: 0,
      admin: {
        description: 'Nižšie číslo = vyššie v zozname vlastností.',
        position: 'sidebar',
      },
    },
  ],
}
