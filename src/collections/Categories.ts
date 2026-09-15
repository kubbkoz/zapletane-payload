import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { slugField } from '@/fields/slug'
import { createSlugRedirectHook } from '@/lib/redirects'

/**
 * Kategórie katalógu.
 *
 * Od Z7 majú vlastnú vstupnú stránku `/kategoria/<slug>` (výpis obchodu
 * predfiltrovaný na danú kategóriu), takže `slug` už nie je len technický
 * identifikátor, ale verejná adresa — premenovanie kategórie preto zakladá
 * presmerovanie zo starej adresy rovnako ako pri produkte či článku.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    description: 'Kategórie produktov. Každá má vlastnú stránku /kategoria/<url-adresa>.',
    group: 'Content',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Názov',
      required: true,
    },
    slugField({ retainLegacyCheckbox: true }),
  ],
  hooks: {
    afterChange: [createSlugRedirectHook('categories')],
  },
  labels: {
    plural: 'Kategórie',
    singular: 'Kategória',
  },
}
