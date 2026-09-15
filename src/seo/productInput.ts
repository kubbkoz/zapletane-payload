import type { BasePayload } from 'payload'

import type { SeoProductInput, SeoPropertyInput } from './generate'

/**
 * Prevod produktového dokumentu (alebo dát z `beforeChange`) na vstup pre
 * generátor meta údajov.
 *
 * Prečo vlastný krok: vzťahy sú raz id, raz celý dokument — podľa `depth`,
 * ktorým volajúci čítal. PDP číta `depth: 3` (hotové dokumenty), hook v
 * kolekcii dostane `data` s holými id. Generátor chce v oboch prípadoch to
 * isté: názov vlastnosti, jej hodnotu a jednotku. Nevyriešené id sa dotiahnu
 * jedným dopytom na kolekciu (nie N+1) a keď dopyt zlyhá, vlastnosť sa jednoducho
 * vynechá — meta sa musia vygenerovať aj tak.
 */

type PropertyEntry = {
  property?: unknown
  value?: null | string
}

type ProductLike = {
  categories?: unknown
  description?: unknown
  dimensions?: null | {
    depth?: null | number
    height?: null | number
    weight?: null | number
    width?: null | number
  }
  priceInEUR?: null | number
  properties?: null | PropertyEntry[]
  title?: null | string
}

/** Id vzťahu, nech už prišiel ako číslo, reťazec alebo celý dokument. */
const relationshipId = (value: unknown): null | number | string => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const id = (value as { id?: number | string }).id
    return id ?? null
  }
  return value as number | string
}

const asRecord = (value: unknown): null | Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

export const toSeoProductInput = async (
  doc: ProductLike,
  payload?: BasePayload,
): Promise<SeoProductInput> => {
  const entries = (doc.properties ?? []).filter(Boolean)

  // Id, ktoré ešte nemáme ako dokument — dotiahnu sa naraz.
  const unresolved = entries
    .filter((entry) => !asRecord(entry.property))
    .map((entry) => relationshipId(entry.property))
    .filter((id): id is number | string => id !== null)

  const resolved = new Map<string, { name?: string; unit?: null | string }>()

  if (unresolved.length && payload) {
    try {
      const result = await payload.find({
        collection: 'product-properties',
        depth: 0,
        limit: unresolved.length,
        pagination: false,
        where: { id: { in: unresolved } },
      })

      for (const property of result.docs) {
        resolved.set(String(property.id), { name: property.name, unit: property.unit })
      }
    } catch {
      // Bez názvov vlastností sa meta vygenerujú z popisu a ceny.
    }
  }

  const properties: SeoPropertyInput[] = entries.map((entry) => {
    const populated = asRecord(entry.property)
    const id = relationshipId(entry.property)
    const lookup = id === null ? undefined : resolved.get(String(id))

    return {
      name: (populated?.name as string) ?? lookup?.name ?? null,
      unit: (populated?.unit as string) ?? lookup?.unit ?? null,
      value: entry.value ?? null,
    }
  })

  const categories = Array.isArray(doc.categories)
    ? doc.categories
        .map((category) => asRecord(category)?.title)
        .filter((title): title is string => typeof title === 'string' && Boolean(title.trim()))
    : []

  return {
    categories,
    description: doc.description,
    dimensions: doc.dimensions ?? null,
    price: doc.priceInEUR ?? null,
    properties,
    title: doc.title ?? '',
  }
}
