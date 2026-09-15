import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Doprava — the shipping options the shopper picks from at checkout.
 *
 * Prices are integer minor units (eurocents), exactly like the ecommerce
 * plugin's `priceInEUR` / `amount` fields, so the whole basket stays in one
 * unit and `<Price />` can format any of them without conversion.
 *
 * Read access is public: the checkout page (a server component) lists the
 * enabled methods, and the storefront must be able to do that for guests.
 * Everything else is admin-only.
 */
export const ShippingMethods: CollectionConfig = {
  slug: 'shipping-methods',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'type', 'price', 'freeAboveSubtotal', 'enabled', 'sortOrder'],
    description:
      'Spôsoby doručenia ponúkané v pokladni. Cena je v eurocentoch (4.90 € = 490). Vypnutý spôsob sa v pokladni nezobrazí.',
    group: 'Ecommerce',
    useAsTitle: 'title',
  },
  defaultSort: 'sortOrder',
  labels: {
    plural: 'Spôsoby dopravy',
    singular: 'Spôsob dopravy',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Názov',
      required: true,
      admin: {
        description: 'Napr. „Kuriér“ alebo „Osobný odber“.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Popis',
      admin: {
        description: 'Krátky doplňujúci text pod názvom v pokladni.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'price',
          type: 'number',
          label: 'Cena (v eurocentoch)',
          required: true,
          defaultValue: 0,
          min: 0,
          admin: {
            description: '490 = 4,90 €. Nula = doprava zadarmo.',
            width: '50%',
          },
        },
        {
          name: 'type',
          type: 'select',
          label: 'Typ dopravy',
          required: true,
          defaultValue: 'courier',
          options: [
            { label: 'Kuriér', value: 'courier' },
            { label: 'Výdajné miesto / balíkovňa', value: 'pickupPoint' },
            { label: 'Osobný odber', value: 'personal' },
          ],
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'deliveryEstimate',
      type: 'text',
      label: 'Odhad doručenia',
      admin: {
        description: 'Napr. „2–4 dni“. Zobrazí sa pri výbere dopravy.',
      },
    },
    // --- Pravidlá dopravy (X1) --------------------------------------------
    // The threshold is applied on the server in src/payments/shared/fees.ts —
    // the storefront only *shows* it. Compared against the product subtotal
    // BEFORE any fee and BEFORE a discount code, which is the number the
    // shopper sees as „Medzisúčet" in the summary.
    {
      name: 'freeAboveSubtotal',
      type: 'number',
      label: 'Doprava zadarmo od (v eurocentoch)',
      min: 0,
      admin: {
        description:
          '10000 = 100 €. Keď medzisúčet košíka dosiahne túto sumu, doprava je zadarmo. Prázdne pole = doprava nikdy nie je zadarmo.',
      },
    },
    {
      name: 'rules',
      type: 'textarea',
      label: 'Poznámka k pravidlám',
      admin: {
        description:
          'Interná poznámka k pravidlám tejto dopravy (hmotnosť, regióny, výnimky). Zákazníkovi sa nezobrazuje.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Aktívny',
      defaultValue: true,
      admin: {
        description: 'Vypnutý spôsob dopravy sa zákazníkom v pokladni nezobrazí.',
        position: 'sidebar',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Poradie',
      defaultValue: 0,
      admin: {
        description: 'Nižšie číslo = vyššie v zozname.',
        position: 'sidebar',
      },
    },
  ],
}
