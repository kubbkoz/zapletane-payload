import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin, EUR } from '@payloadcms/plugin-ecommerce'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'

import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'

import { manualAdapter } from '@/payments/manual'
import { comgateAdapter } from '@/payments/comgate'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { globalConfigs } from '@/globals'

const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | ${SITE_NAME}` : SITE_NAME
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

// --- MCP capability ceilings (see the mcpPlugin() call below for how these
// map onto specific collections) -------------------------------------------
const mcpFullCrud = { create: true, delete: true, find: true, update: true }
const mcpFindAndUpdate = { create: false, delete: false, find: true, update: true }
const mcpFindOnly = { create: false, delete: false, find: true, update: false }

type MCPCollectionEntry = NonNullable<NonNullable<MCPPluginConfig['collections']>['users']>

/**
 * Defense-in-depth for the `users` MCP find tool: strip auth-secret fields
 * from the tool response text even though Payload's REST/Local API output
 * already omits `hash`/`salt` from `users` documents by default.
 */
const redactUserSecrets: NonNullable<MCPCollectionEntry['overrideResponse']> = (response) => {
  response.content = response.content.map((item) => ({
    ...item,
    text:
      typeof item.text === 'string'
        ? item.text
            .replace(/"hash":\s*"[^"]*"/g, '"hash":"[redacted]"')
            .replace(/"salt":\s*"[^"]*"/g, '"salt":"[redacted]"')
        : item.text,
  }))
  return response
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    // --- Adresy: dva logické sloty (Z2) ------------------------------------
    // The account section manages exactly two addresses per customer —
    // „Fakturačná" and „Dodacia" — so the address needs to say which slot it
    // belongs to. Added through `addressesCollectionOverride` (not
    // `addressFields`) on purpose: `addressFields` would also stamp the field
    // onto every embedded address group (orders.shippingAddress,
    // transactions…), where the slot has no meaning and would only widen the
    // schema. Empty value = an address saved before the field existed; the
    // account UI lists those separately instead of losing them.
    addresses: {
      addressesCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: 'kind',
            type: 'select',
            index: true,
            label: 'Typ adresy',
            options: [
              { label: 'Fakturačná', value: 'billing' },
              { label: 'Dodacia', value: 'shipping' },
            ],
            admin: {
              description:
                'Slot, do ktorého adresa patrí v zákazníckom účte. Prázdne = adresa uložená pred zavedením slotov.',
            },
          },
        ],
      }),
    },
    // Slovak storefront sells in euros. The plugin derives the price field
    // names from the currency code (priceInEUR), formats via Intl with the
    // EUR symbol, and Stripe intents are created in EUR.
    currencies: {
      defaultCurrency: 'EUR',
      supportedCurrencies: [EUR],
    },
    customers: {
      slug: 'users',
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
          // --- Doprava a platba (W1) --------------------------------------
          // The plugin's order schema knows only about `amount` (the grand
          // total). These four fields record *how* that total was reached, so
          // the confirmation page, the admin and any future invoice can break
          // it down without recomputing anything from the cart.
          {
            name: 'shippingMethod',
            type: 'relationship',
            relationTo: 'shipping-methods',
            admin: {
              position: 'sidebar',
              description: 'Spôsob doručenia zvolený v pokladni.',
            },
            label: 'Spôsob dopravy',
          },
          {
            name: 'paymentType',
            type: 'select',
            options: [
              { label: 'Dobierka', value: 'cod' },
              { label: 'Bankový prevod', value: 'bankTransfer' },
              { label: 'Platba kartou', value: 'card' },
            ],
            admin: {
              position: 'sidebar',
              description: 'Určuje, aké pokyny sa zákazníkovi zobrazia po objednaní.',
            },
            label: 'Typ platby',
          },
          {
            name: 'shippingFee',
            type: 'number',
            defaultValue: 0,
            admin: {
              position: 'sidebar',
              description: 'V eurocentoch. Je už započítaný v celkovej sume.',
            },
            label: 'Poplatok za dopravu',
          },
          {
            name: 'codFee',
            type: 'number',
            defaultValue: 0,
            admin: {
              position: 'sidebar',
              description: 'V eurocentoch. Je už započítaný v celkovej sume.',
            },
            label: 'Poplatok za dobierku',
          },
          // --- Zľavový kód (X1) -------------------------------------------
          // A snapshot, not a relationship: the order must still say what the
          // shopper actually got even if the code is later edited or deleted.
          {
            name: 'discountCode',
            type: 'text',
            index: true,
            admin: {
              position: 'sidebar',
              description: 'Kód uplatnený v pokladni (prázdne = bez zľavy).',
            },
            label: 'Zľavový kód',
          },
          {
            name: 'discountAmount',
            type: 'number',
            defaultValue: 0,
            admin: {
              position: 'sidebar',
              description: 'V eurocentoch. Je už odpočítaný z celkovej sumy.',
            },
            label: 'Zľava',
          },
        ],
      }),
    },
    payments: {
      paymentMethods: [
        // Offline payments (dobierka + bankový prevod). No gateway, no
        // credentials — the order is created straight from the cart snapshot.
        // See src/payments/manual.
        manualAdapter(),
        // Card payments via Comgate. Always registered so the endpoints exist
        // and the config type-checks; refuses to initiate without
        // COMGATE_MERCHANT/COMGATE_SECRET, and the storefront only offers it
        // when an *enabled* `payment-methods` row of type `card` exists.
        comgateAdapter(),
        // Dummy fallbacks keep the config importable during `next build` and in
        // environments without real credentials. Real keys are required only to
        // actually process a payment.
        stripeAdapter({
          secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_dummy',
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy',
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET || 'whsec_dummy',
        }),
      ],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
    },
  }),
  // --- Model Context Protocol (MCP) server -------------------------------
  // Approved scope (project owner sign-off, do not widen without new
  // sign-off — see MCP-PLAN.md):
  //   - full CRUD  : products, categories, pages, media, variants,
  //                  variantOptions, shipping-methods, payment-methods,
  //                  discount-codes, product-filters, product-properties, and
  //                  every registered global.
  //   - find+update: orders, transactions, carts, addresses (no create/delete
  //                  — these are financial/checkout records, not
  //                  agent-authored content).
  //   - find only  : users (no create/update/delete — avoids privilege
  //                  escalation / account takeover via an MCP tool call).
  // `globals` is built from `globalConfigs` (the same array `payload.config`
  // registers globals from) so a newly added global is exposed automatically
  // — no edit needed here.
  mcpPlugin({
    userCollection: 'users',
    // --- API key collection visibility / access (Y1) ----------------------
    // The plugin ships a fail-safe default: every operation on
    // `payload-mcp-api-keys` is restricted to the *requesting user's own*
    // documents (`restrictToOwnKeys`). That is why the shop owner opened the
    // admin and saw an empty (or missing) key list: the keys exist, but they
    // are owned by the user that minted them (the MCP dev/production admin),
    // so another admin's row filter excluded every document.
    //
    // For this project the key list is an administration screen: an admin must
    // be able to audit and revoke *every* key, not just their own. So all five
    // operations are lifted from "own keys" to `isAdmin` — which is a
    // *narrowing* for everyone below admin (a customer no longer has any
    // access at all, not even to their own key) and a widening only for
    // admins.
    //
    // Deliberately NOT touched: the `user` field's `create`/`update` access
    // (both hard-false in the plugin). A key acts as the user it is bound to,
    // so re-binding stays impossible even for an admin — a new key is always
    // issued to whoever creates it.
    overrideApiKeyCollection: (collection) => ({
      ...collection,
      access: {
        ...collection.access,
        create: isAdmin,
        delete: isAdmin,
        read: isAdmin,
        unlock: isAdmin,
        update: isAdmin,
      },
      admin: {
        ...collection.admin,
        defaultColumns: ['label', 'user', 'description', 'updatedAt'],
        description:
          'API kľúče pre MCP klientov. Každý kľúč koná ako používateľ, ku ktorému patrí, a jeho zaškrtávacie polia určujú, ktoré nástroje smie klient použiť.',
        // Explicit: the collection belongs in the admin navigation. Without a
        // readable key list there is no way to see what a client may do.
        hidden: false,
      },
      labels: {
        plural: 'MCP API kľúče',
        singular: 'MCP API kľúč',
      },
    }),
    collections: {
      products: {
        description: 'Store catalog products: title, price, description, images, variants.',
        enabled: mcpFullCrud,
      },
      categories: {
        description: 'Product category taxonomy used for catalog navigation.',
        enabled: mcpFullCrud,
      },
      pages: {
        description: 'CMS content pages (non-catalog site content).',
        enabled: mcpFullCrud,
      },
      media: {
        description: 'Uploaded images/assets used by products and pages.',
        enabled: mcpFullCrud,
      },
      variants: {
        description: 'Per-product variant records (a specific combination of variant options).',
        enabled: mcpFullCrud,
      },
      variantOptions: {
        description: 'Selectable options belonging to a variant type (e.g. "Red", "XL").',
        enabled: mcpFullCrud,
      },
      variantTypes: {
        description: 'Variant type definitions (e.g. "Color", "Size") that group variant options.',
        enabled: mcpFullCrud,
      },
      'shipping-methods': {
        description:
          'Shipping options offered at checkout (title, price in eurocents, type, delivery estimate, enabled, sort order). Shop configuration, agent-editable.',
        enabled: mcpFullCrud,
      },
      'payment-methods': {
        description:
          'Payment options offered at checkout (title, type cod/bankTransfer/card, surcharge in eurocents, instructions, enabled, sort order). Shop configuration, agent-editable.',
        enabled: mcpFullCrud,
      },
      'discount-codes': {
        description:
          'Checkout discount codes (code, type percent/fixed, value, minimum subtotal in eurocents, validity window, max uses, used count, enabled). Shop configuration, agent-editable.',
        enabled: mcpFullCrud,
      },
      'product-filters': {
        description:
          'Admin-defined filters for the shop page (label, slug, type tags/categories/price/availability, tag options, category subset, enabled, sort order). Shop configuration, agent-editable.',
        enabled: mcpFullCrud,
      },
      'product-properties': {
        description:
          'Shop-wide product property definitions (name, slug, optional unit, optional predefined value suggestions, sort order). The per-product value lives in products.properties[]. Catalog configuration, agent-editable.',
        enabled: mcpFullCrud,
      },
      orders: {
        description: 'Customer orders placed via checkout/Stripe. Read + status/fulfillment updates only — never agent-created or deleted.',
        enabled: mcpFindAndUpdate,
      },
      transactions: {
        description: 'Payment transactions linked to orders. Read + update only — financial records, never agent-created or deleted.',
        enabled: mcpFindAndUpdate,
      },
      carts: {
        description: "Customers' in-progress shopping carts. Read + update only.",
        enabled: mcpFindAndUpdate,
      },
      addresses: {
        description: 'Customer shipping/billing addresses. Read + update only.',
        enabled: mcpFindAndUpdate,
      },
      users: {
        description: 'Customer/admin accounts. Read-only — no create/update/delete tool is exposed for this collection.',
        enabled: mcpFindOnly,
        overrideResponse: redactUserSecrets,
      },
    },
    globals: Object.fromEntries(
      globalConfigs.map((global) => [
        global.slug,
        {
          description: `Site-wide "${global.slug}" global configuration.`,
          // Globals only ever support find/update (they're singletons) —
          // `true` grants the maximum available, i.e. both.
          enabled: true,
        },
      ]),
    ) as NonNullable<MCPPluginConfig['globals']>,
  }),
]
