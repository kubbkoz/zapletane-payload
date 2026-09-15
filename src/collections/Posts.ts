import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { revalidatePath } from 'next/cache'

import { adminOnly } from '@/access/adminOnly'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { Banner } from '@/blocks/Banner/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Code } from '@/blocks/Code/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { slugField } from '@/fields/slug'
import { createSlugRedirectHook } from '@/lib/redirects'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'

/**
 * Blog (Z7).
 *
 * Tvarom je to dvojička `Pages`: rovnaký prístup, rovnaká skupina v menu,
 * rovnaké verzie s autosave aj rovnaká SEO záložka. Rozdiel je v účele a v
 * adrese — `Pages` sú statické stránky priamo na `/<slug>`, články žijú na
 * `/blog/<slug>` a majú navyše to, čo článok robí článkom: úvodný obrázok,
 * perex a dátum publikovania.
 *
 * Editor je ten „plný" z produktového popisu (nadpisy, pevný aj plávajúci
 * panel, vodorovná čiara) rozšírený o bloky, ktoré vie vykresliť
 * `src/components/RichText` — obrázok, banner, výzva k akcii a kód.
 */

const revalidatePost: CollectionAfterChangeHook = ({ doc, previousDoc, req: { context, payload } }) => {
  if (context.disableRevalidate) return doc

  const paths = new Set<string>(['/blog'])

  if ((doc as { _status?: string })?._status === 'published' && (doc as { slug?: string })?.slug) {
    paths.add(`/blog/${(doc as { slug?: string }).slug}`)
  }

  const previousSlug = (previousDoc as { slug?: string })?.slug

  if ((previousDoc as { _status?: string })?._status === 'published' && previousSlug) {
    paths.add(`/blog/${previousSlug}`)
  }

  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (err) {
      payload.logger.debug?.({ err }, `[posts] revalidatePath(${path}) mimo požiadavky`)
    }
  }

  return doc
}

const revalidatePostDelete: CollectionAfterDeleteHook = ({ doc, req: { context, payload } }) => {
  if (context.disableRevalidate) return doc

  try {
    revalidatePath('/blog')

    if ((doc as { slug?: string })?.slug) revalidatePath(`/blog/${(doc as { slug?: string }).slug}`)
  } catch (err) {
    payload.logger.debug?.({ err }, '[posts] revalidatePath mimo požiadavky')
  }

  return doc
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOrPublishedStatus,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'publishedAt', '_status'],
    description:
      'Články na blogu. Každý článok má vlastnú adresu /blog/<url-adresa>; tá sa dopĺňa z názvu sama.',
    group: 'Content',
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'posts',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'posts',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultSort: '-publishedAt',
  labels: {
    plural: 'Články',
    singular: 'Článok',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Názov článku',
      required: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Dátum publikovania',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Podľa neho sa články radia na /blog — najnovší hore.',
        position: 'sidebar',
      },
      defaultValue: () => new Date().toISOString(),
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            // Publikovanie bez vyplneného dátumu = publikované teraz.
            if (siblingData._status === 'published' && !value) return new Date()

            return value
          },
        ],
      },
      index: true,
    },
    /**
     * AI asistent (Z15) — téma na vstupe, hotový koncept na výstupe.
     *
     * `collapsible` je čisto vizuálne zoskupenie: v databáze vzniká jediný
     * stĺpec `ai_prompt`. Pomenovaná `group` by pole zanorila a zmenila
     * schému, čo za rámček v bočnom paneli nestojí.
     *
     * Pole `aiPrompt` zostáva uložené aj po vygenerovaní — je to poznámka,
     * z čoho článok vznikol, a zároveň východisko, keď si majiteľka nechá
     * napísať ďalšiu verziu.
     */
    {
      type: 'collapsible',
      admin: {
        initCollapsed: false,
        position: 'sidebar',
      },
      fields: [
        {
          name: 'aiPrompt',
          type: 'textarea',
          label: 'Téma / pokyny pre článok',
          admin: {
            description:
              'O čom má článok byť, komu je určený a čo v ňom zdôrazniť. Pokojne celými vetami — čím konkrétnejšie zadanie, tým lepší text. Napr.: „Ako vybrať prvú hračku pre bábätko, tipy z vlastnej skúsenosti, spomeň pletené hračky."',
            rows: 5,
          },
          maxLength: 2000,
        },
        {
          name: 'generateArticle',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/admin/GenerateArticleButton#GenerateArticleButton',
            },
          },
          label: 'Vygenerovať článok',
        },
      ],
      label: 'AI asistent',
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              label: 'Úvodný obrázok',
              admin: {
                description: 'Zobrazí sa na karte vo výpise aj na začiatku článku.',
              },
              relationTo: 'media',
            },
            {
              name: 'excerpt',
              type: 'textarea',
              label: 'Perex',
              admin: {
                description:
                  'Voliteľné. Krátke zhrnutie (1–2 vety) pod názvom vo výpise článkov.',
              },
              maxLength: 300,
            },
            {
              name: 'content',
              type: 'richText',
              label: 'Text článku',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => [
                  ...rootFeatures,
                  HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                  BlocksFeature({ blocks: [Banner, MediaBlock, CallToAction, Code] }),
                ],
              }),
              required: true,
            },
          ],
          label: 'Obsah',
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
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePost, createSlugRedirectHook('posts')],
    afterDelete: [revalidatePostDelete],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}

export default Posts
