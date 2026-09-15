import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { slugField } from '@/fields/slug'
import { createSlugRedirectHook } from '@/lib/redirects'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

import { revalidateFeedsTag } from '@/lib/feeds/cache'
import { generateProductMeta } from '@/seo/generate'
import { toSeoProductInput } from '@/seo/productInput'
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

/**
 * Automatické SEO/GEO meta (Z4): po pridaní produktu nemusí nikto písať meta
 * title ani popis — doplnia sa samé, v slovenčine, z toho, čo o produkte vieme.
 *
 * Kedy sa spustí:
 *   - `create` — vždy, keď je čo generovať (produkt už má názov);
 *   - `update` — len keď sú OBE meta polia prázdne. Čokoľvek, čo majiteľka
 *     napísala ručne, je nedotknuteľné; polovičný stav (vyplnený titulok,
 *     prázdny popis) sa tiež nechá tak — od toho sú tlačidlá „Generovať".
 *
 * Prečo sa preskakuje autosave: produkty majú `versions.drafts.autosave`, takže
 * počas písania odchádza uloženie každých pár sekúnd. Bez tejto poistky by meta
 * vznikli z rozpísaného názvu („Ple…") a už by sa nikdy neprepísali — a pri
 * zapnutom AI motore by to znamenalo hromadu zbytočných volaní. Publikovanie
 * (aj ručné „Uložiť koncept") autosave príznak nenesie, takže tam hook bežne
 * dobehne — s finálnym názvom a popisom.
 *
 * Nikdy neblokuje uloženie: generátor má vlastný časovač a pri akejkoľvek chybe
 * padá na deterministickú šablónu; prípadná výnimka sa tu ešte raz odchytí.
 */
const autofillProductMeta: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const meta = data?.meta as null | undefined | { description?: null | string; title?: null | string }
  const hasTitle = Boolean(meta?.title?.trim())
  const hasDescription = Boolean(meta?.description?.trim())

  if (hasTitle && hasDescription) return data
  if (operation === 'update' && (hasTitle || hasDescription)) return data

  const autosave = (req?.query as undefined | { autosave?: unknown })?.autosave

  if (autosave === true || autosave === 'true') return data

  // `data` je pri PATCH-i len to, čo sa mení — fakty o produkte treba čítať z
  // uloženého dokumentu doplneného o prichádzajúce zmeny.
  const merged = { ...(originalDoc ?? {}), ...(data ?? {}) }

  if (!String(merged.title ?? '').trim()) return data

  try {
    const generated = await generateProductMeta(await toSeoProductInput(merged, req?.payload))

    data.meta = {
      ...(meta ?? {}),
      ...(hasTitle ? {} : { title: generated.metaTitle }),
      ...(hasDescription ? {} : { description: generated.metaDescription }),
    }
  } catch (error) {
    req?.payload?.logger?.warn?.(
      `[seo] Nepodarilo sa vygenerovať meta pre produkt „${String(merged.title)}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  return data
}

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  labels: { plural: 'Produkty', singular: 'Produkt' },
  hooks: {
    ...defaultCollection?.hooks,
    // Z7: premenovanie produktu prepíše `slug`, takže stará adresa
    // `/products/<starý-slug>` musí dostať 301 na tú novú.
    afterChange: [
      ...(defaultCollection?.hooks?.afterChange ?? []),
      revalidateFeedsOnChange,
      createSlugRedirectHook('products'),
    ],
    afterDelete: [...(defaultCollection?.hooks?.afterDelete ?? []), revalidateFeedsOnDelete],
    beforeChange: [...(defaultCollection?.hooks?.beforeChange ?? []), autofillProductMeta],
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

            // `hasGenerateFn` zapína tlačidlo „Generovať" aj nad popisom —
            // generátor pre oba texty je nastavený v `seoPlugin` (src/plugins).
            MetaDescriptionField({
              hasGenerateFn: true,
            }),
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
    // --- Pôvod importu (Z12) ----------------------------------------------
    // Vyplní ho scraper (`src/scraper/importProduct.ts`) a slúži na dve veci:
    // je to kľúč idempotencie („tento produkt sme z tejto adresy už raz
    // stiahli, preskoč ho") a stopa pre majiteľku, odkiaľ položka prišla.
    // Ručne založený produkt má skupinu prázdnu — to je normálny stav.
    //
    // `index` je na `url`, lebo práve podľa nej sa hľadá pred KAŽDÝM
    // zakladaním; bez indexu by import stoviek položiek robil stovky
    // sekvenčných prechodov cez celú tabuľku produktov.
    {
      name: 'importSource',
      type: 'group',
      label: 'Pôvod importu',
      access: {
        // Viditeľné a editovateľné len pre administrátorku: zákazníkovi je
        // adresa cudzieho e-shopu na nič a v REST odpovedi nemá čo robiť.
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        description:
          'Vypĺňa sa automaticky pri importe z webu. Podľa adresy sa pozná, že produkt už raz stiahnutý bol, takže opakovaný import ho preskočí.',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'url',
          type: 'text',
          label: 'Adresa zdroja',
          index: true,
          admin: {
            description: 'Stránka produktu v pôvodnom e-shope.',
          },
        },
        {
          name: 'externalId',
          type: 'text',
          label: 'Identifikátor v zdroji',
          admin: {
            description: 'Číslo alebo slug z adresy zdroja — len pre orientáciu.',
          },
        },
      ],
    },
    slugField({ retainLegacyCheckbox: true }),
  ],
})
