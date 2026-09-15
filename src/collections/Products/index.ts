import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { slugField } from 'payload'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidateFeedsTag } from '@/lib/feeds/cache'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, RelationshipField, Where } from 'payload'

/**
 * Shared `filterOptions` for the three product↔product relationships
 * (relatedProducts / crossSell / upsell): never offer the product itself.
 * Copied from the template's `relatedProducts`, including its seeding caveat —
 * during a seed the document id is still undefined, so the filter degrades to
 * "any existing product" instead of an impossible query.
 */
const excludeSelf: RelationshipField['filterOptions'] = ({ id }) => {
  if (id) {
    return {
      id: {
        not_in: [id],
      },
    }
  }

  return {
    id: {
      exists: true,
    },
  }
}

/**
 * Produktové feedy (Y2): every catalog write purges the rendered feeds, so
 * `/feeds/*` is never more than one edit behind the shop.
 *
 * Fires for the admin UI, the REST/GraphQL API, MCP tool calls and any Local
 * API write inside a request — and is a silent no-op where `revalidateTag`
 * cannot run (seed script, migration, `payload` CLI), which the 1h cache
 * ceiling in `getFeedPayload` covers.
 */
const revalidateFeedsOnChange: CollectionAfterChangeHook = ({ doc, req }) => {
  if (!req.context.disableRevalidate) revalidateFeedsTag(req.payload)

  return doc
}

const revalidateFeedsOnDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (!req.context.disableRevalidate) revalidateFeedsTag(req.payload)

  return doc
}

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  hooks: {
    ...defaultCollection?.hooks,
    afterChange: [...(defaultCollection?.hooks?.afterChange ?? []), revalidateFeedsOnChange],
    afterDelete: [...(defaultCollection?.hooks?.afterDelete ?? []), revalidateFeedsOnDelete],
  },
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['title', 'enableVariants', '_status', 'variants.variants'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInEUR: true,
    inventory: true,
    meta: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              minRows: 1,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  admin: {
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },

            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock],
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            ...defaultCollection.fields,
            {
              name: 'relatedProducts',
              type: 'relationship',
              label: 'Súvisiace produkty',
              admin: {
                description: 'Voľné odporúčania zobrazené na stránke produktu.',
              },
              // ID comes back as undefined during seeding so we need to handle that case
              filterOptions: excludeSelf,
              hasMany: true,
              relationTo: 'products',
            },
            // --- Cross-sell / upsell (Y1) -------------------------------
            // Two *separate* lists on purpose: they are read in different
            // places (košík vs. PDP) and answer different questions, so a
            // single "related" list cannot serve both without the storefront
            // guessing. Both exclude the product itself.
            {
              name: 'crossSell',
              type: 'relationship',
              label: 'Doplnkové produkty (cross-sell)',
              admin: {
                description: 'Zobrazia sa v košíku ako tip na dokúpenie.',
              },
              filterOptions: excludeSelf,
              hasMany: true,
              relationTo: 'products',
            },
            {
              name: 'upsell',
              type: 'relationship',
              label: 'Upsell produkty',
              admin: {
                description: 'Drahšie/lepšie alternatívy zobrazené na stránke produktu.',
              },
              filterOptions: excludeSelf,
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Product Details',
        },
        // --- Vlastnosti a rozmery (Y1) ------------------------------------
        // Own tab so the product form does not grow a third long scroll:
        // the property table and the shipping dimensions are what the PDP
        // (Y3) and the product feeds (Y2) read, and they are edited together.
        {
          fields: [
            {
              name: 'properties',
              type: 'array',
              label: 'Vlastnosti',
              labels: { plural: 'Vlastnosti', singular: 'Vlastnosť' },
              admin: {
                description:
                  'Vlastnosť vyberáš zo spoločného zoznamu („Vlastnosti“ v menu), hodnotu píšeš pre tento produkt. Jednotka sa berie z definície vlastnosti.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'property',
                      type: 'relationship',
                      label: 'Vlastnosť',
                      relationTo: 'product-properties',
                      required: true,
                      admin: {
                        description: 'Napr. „Materiál“.',
                        sortOptions: 'name',
                        width: '50%',
                      },
                    },
                    {
                      name: 'value',
                      type: 'text',
                      label: 'Hodnota',
                      required: true,
                      admin: {
                        description:
                          'Napr. „vlna“. Predvolené hodnoty pri vlastnosti sú len návrh — zadať sa dá čokoľvek.',
                        width: '50%',
                      },
                    },
                  ],
                },
              ],
            },
            {
              name: 'dimensions',
              type: 'group',
              label: 'Rozmery a hmotnosť',
              admin: {
                description:
                  'Rozmery v cm, hmotnosť v gramoch — použije sa aj v produktových feedoch.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'width',
                      type: 'number',
                      label: 'Šírka (cm)',
                      min: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'height',
                      type: 'number',
                      label: 'Výška (cm)',
                      min: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'depth',
                      type: 'number',
                      label: 'Hĺbka (cm)',
                      min: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'weight',
                      type: 'number',
                      label: 'Hmotnosť (g)',
                      min: 0,
                      admin: { width: '25%' },
                    },
                  ],
                },
              ],
            },
          ],
          label: 'Vlastnosti',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    // --- Vlastné filtre (X1) ----------------------------------------------
    // Free-form tags that pair with the `product-filters` collection: a filter
    // of type „Štítky" lists its own options, and a product shows up under an
    // option when this array contains that option's value verbatim.
    // Additive and inert until the shop panel consumes it (X4).
    {
      name: 'filterTags',
      type: 'array',
      label: 'Filtrovacie štítky',
      labels: { plural: 'Štítky', singular: 'Štítok' },
      admin: {
        description:
          'Štítky, podľa ktorých sa dá produkt filtrovať v obchode. Hodnota sa musí presne zhodovať s možnosťou v kolekcii „Filtre v obchode“ (napr. „vlna“).',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          label: 'Štítok',
          required: true,
        },
      ],
    },
    slugField(),
  ],
})
