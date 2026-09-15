import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Zľavové kódy — checkout discount codes (X1).
 *
 * Money is integer minor units (eurocents) exactly like `priceInEUR`,
 * `shipping-methods.price` and `payment-methods.surcharge`, so nothing in the
 * basket ever needs converting.
 *
 * `type` decides how `value` is read:
 *   - `percent` -> 1–100, a percentage of the *product subtotal*
 *   - `fixed`   -> eurocents subtracted from the product subtotal
 *
 * A discount never touches the delivery price or the dobierka surcharge, and
 * never pushes the subtotal below zero — see src/payments/shared/discounts.ts,
 * which is the only place a code is ever evaluated.
 *
 * Access is admin-only across the board, read included: a code is a secret the
 * shop hands out deliberately, so the storefront must not be able to list them.
 * The checkout validates a *typed* code through a server route that uses the
 * Local API (src/app/(app)/api/discount-codes/validate), never a client query.
 */
export const DiscountCodes: CollectionConfig = {
  slug: 'discount-codes',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['code', 'type', 'value', 'usedCount', 'enabled'],
    description:
      'Zľavové kódy pre pokladňu. Zľava sa vždy počíta len z medzisúčtu tovaru — nikdy z dopravy ani z poplatku za dobierku.',
    group: 'Ecommerce',
    useAsTitle: 'code',
  },
  labels: {
    plural: 'Zľavové kódy',
    singular: 'Zľavový kód',
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      label: 'Kód',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Napr. „ZAPLETANE10“. Ukladá sa vždy VEĽKÝMI písmenami, takže na veľkosti písmen pri zadávaní v pokladni nezáleží.',
      },
      hooks: {
        // Normalised on the way in so the lookup in the checkout can be a plain
        // equality match on an uppercase string — no case-insensitive query
        // (which sqlite and Postgres spell differently) is needed anywhere.
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        ],
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          label: 'Typ zľavy',
          required: true,
          defaultValue: 'percent',
          options: [
            { label: 'Percentuálna zľava', value: 'percent' },
            { label: 'Pevná suma', value: 'fixed' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'value',
          type: 'number',
          label: 'Hodnota',
          required: true,
          min: 1,
          admin: {
            description:
              'Pri percentuálnej zľave 1–100 (napr. 10 = 10 %), pri pevnej sume v eurocentoch (500 = 5 €).',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'minSubtotal',
      type: 'number',
      label: 'Minimálny medzisúčet (v eurocentoch)',
      min: 0,
      admin: {
        description: '5000 = 50 €. Prázdne pole = kód platí pri akejkoľvek sume.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'validFrom',
          type: 'date',
          label: 'Platný od',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Prázdne = platí okamžite.',
            width: '50%',
          },
        },
        {
          name: 'validUntil',
          type: 'date',
          label: 'Platný do',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Prázdne = platí bez obmedzenia.',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'maxUses',
          type: 'number',
          label: 'Maximálny počet použití',
          min: 1,
          admin: {
            description: 'Prázdne = neobmedzene.',
            width: '50%',
          },
        },
        {
          name: 'usedCount',
          type: 'number',
          label: 'Počet použití',
          defaultValue: 0,
          admin: {
            description:
              'Zvyšuje sa automaticky pri vytvorení objednávky (nie pri overení kódu v pokladni).',
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Aktívny',
      defaultValue: true,
      admin: {
        description: 'Vypnutý kód pokladňa odmietne bez ohľadu na platnosť.',
        position: 'sidebar',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Interná poznámka',
      admin: {
        description: 'Na čo bol kód vydaný. Zákazníkovi sa nezobrazuje.',
        position: 'sidebar',
      },
    },
  ],
}
