import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { adminOnly } from '@/access/adminOnly'

/**
 * Platby — the payment options the shopper picks from at checkout.
 *
 * `type` drives what actually happens on submit (see src/payments):
 *   - `cod`          -> dobierka: order is created immediately, paid on delivery
 *   - `bankTransfer` -> order is created immediately, `instructions` + the bank
 *                       details from Site Settings are shown on the confirmation
 *   - `card`         -> online gateway, `gateway` picks which one (Comgate by
 *                       default, Stripe kept available behind its own env)
 *
 * `surcharge` is an integer in minor units (eurocents) added to the order total
 * — the dobierka fee is the reason it exists.
 *
 * Read access is public so the checkout server component can list the enabled
 * methods for guests; everything else is admin-only.
 */
export const PaymentMethods: CollectionConfig = {
  slug: 'payment-methods',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'type', 'surcharge', 'enabled', 'sortOrder'],
    description:
      'Spôsoby platby ponúkané v pokladni. Príplatok je v eurocentoch (1.50 € = 150). Vypnutý spôsob sa v pokladni nezobrazí.',
    group: 'Ecommerce',
    useAsTitle: 'title',
  },
  defaultSort: 'sortOrder',
  labels: {
    plural: 'Spôsoby platby',
    singular: 'Spôsob platby',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Názov',
      required: true,
      admin: {
        description: 'Napr. „Dobierka“ alebo „Bankový prevod“.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          label: 'Typ platby',
          required: true,
          defaultValue: 'cod',
          options: [
            { label: 'Dobierka', value: 'cod' },
            { label: 'Bankový prevod', value: 'bankTransfer' },
            { label: 'Platba kartou', value: 'card' },
          ],
          admin: {
            description:
              'Dobierka a prevod vytvoria objednávku bez online platby. Karta presmeruje na platobnú bránu.',
            width: '50%',
          },
        },
        {
          name: 'surcharge',
          type: 'number',
          label: 'Príplatok (v eurocentoch)',
          required: true,
          defaultValue: 0,
          min: 0,
          admin: {
            description: '150 = 1,50 €. Typicky poplatok za dobierku.',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'gateway',
      type: 'select',
      label: 'Platobná brána',
      defaultValue: 'comgate',
      options: [
        { label: 'Comgate', value: 'comgate' },
        { label: 'Stripe', value: 'stripe' },
      ],
      admin: {
        condition: (data) => data?.type === 'card',
        description:
          'Použije sa len pri type „Platba kartou“. Comgate vyžaduje COMGATE_MERCHANT/COMGATE_SECRET, Stripe svoje STRIPE_* premenné.',
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
      name: 'instructions',
      type: 'richText',
      label: 'Pokyny po objednaní',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          FixedToolbarFeature(),
          HeadingFeature({ enabledHeadingSizes: ['h3', 'h4'] }),
        ],
      }),
      admin: {
        description:
          'Zobrazí sa zákazníkovi na potvrdení objednávky — pri bankovom prevode sem patria platobné pokyny (IBAN a variabilný symbol sa doplnia automaticky z Nastavení webu).',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Aktívny',
      defaultValue: true,
      admin: {
        description: 'Vypnutý spôsob platby sa zákazníkom v pokladni nezobrazí.',
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
