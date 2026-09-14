import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'

import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'

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
        ],
      }),
    },
    payments: {
      paymentMethods: [
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
  //                  variantOptions, and every registered global.
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
