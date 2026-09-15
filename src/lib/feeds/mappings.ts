import type { FeedSetting, Product, ProductProperty } from '@/payload-types'

import type { FeedAttribute } from './types'

export type FeedMappingRow = NonNullable<FeedSetting['attributeMappings']>[number]

/**
 * A relationship field is either the populated document or the bare id,
 * depending on the `depth` the caller used. The feed reads the global at
 * `depth: 0` (ids) and the products at `depth: 1` (documents), so both sides of
 * a property comparison have to be reduced to an id before they can be matched.
 */
const relationshipId = (value: unknown): null | string => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const id = (value as { id?: number | string }).id
    return id === undefined || id === null ? null : String(id)
  }
  return String(value)
}

/**
 * Attribute names are written verbatim into XML element names, so a free-form
 * `custom` name is constrained to what is legal there (and harmless): a letter
 * or underscore first, then letters, digits, `:`, `_`, `-` and `.`. Anything
 * else disables that mapping row rather than producing broken XML.
 */
const CUSTOM_ATTRIBUTE_PATTERN = /^[A-Za-z_][A-Za-z0-9:_.-]*$/

/**
 * The element name a mapping row writes into, or `null` when the row is not
 * usable (a `custom` row with an empty or unsafe name).
 */
export const feedAttributeName = (row: FeedMappingRow): null | string => {
  if (row.feedAttribute === 'custom') {
    const custom = row.customAttribute?.trim()

    if (!custom || !CUSTOM_ATTRIBUTE_PATTERN.test(custom)) return null

    return custom
  }

  return row.feedAttribute ?? null
}

/** `40` -> `40`, `0.50` -> `0.5`; feeds want the shortest exact form. */
const formatNumber = (value: number): string => String(Number(value.toFixed(3)))

const formatDimension = (value: unknown, unit: string): null | string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null

  return `${formatNumber(value)} ${unit}`
}

/**
 * Value of one mapping row for one product, or `null` when this product has
 * nothing to say for it (the attribute is then simply omitted for that item —
 * an empty attribute is a feed error, a missing optional one is not).
 */
export const resolveMappingValue = (product: Product, row: FeedMappingRow): null | string => {
  switch (row.source) {
    case 'dimensions.depth':
      return formatDimension(product.dimensions?.depth, 'cm')

    case 'dimensions.height':
      return formatDimension(product.dimensions?.height, 'cm')

    case 'dimensions.weight':
      // NB: weight lives *inside* the dimensions group (Y1) and is stored in
      // grams; Google accepts g/kg/lb/oz for weight attributes.
      return formatDimension(product.dimensions?.weight, 'g')

    case 'dimensions.width':
      return formatDimension(product.dimensions?.width, 'cm')

    case 'filterTags': {
      const tags = (product.filterTags ?? [])
        .map((entry) => entry?.tag?.trim())
        .filter((tag): tag is string => Boolean(tag))

      return tags.length ? tags.join(', ') : null
    }

    case 'property': {
      const wantedId = relationshipId(row.property)

      if (!wantedId) return null

      const match = (product.properties ?? []).find(
        (entry) => relationshipId(entry?.property) === wantedId,
      )

      const value = match?.value?.trim()

      if (!value) return null

      // The unit belongs to the property definition ("cm", "g"), so a mapped
      // value carries it — unless the shop owner already typed it into the
      // value itself.
      const property = match?.property
      const unit =
        typeof property === 'object' && property
          ? (property as ProductProperty).unit?.trim()
          : undefined

      if (!unit || value.toLowerCase().endsWith(unit.toLowerCase())) return value

      return `${value} ${unit}`
    }

    case 'static': {
      const value = row.staticValue?.trim()

      return value || null
    }

    default:
      return null
  }
}

/**
 * Every configured mapping applied to one product.
 *
 * Rules, in order:
 *   - a row with no usable attribute name or no resolvable value is skipped;
 *   - the first row wins for a given attribute, so a later duplicate row cannot
 *     emit the same element twice (which Google rejects for single-value
 *     attributes).
 */
export const resolveMappedAttributes = (
  product: Product,
  rows: FeedMappingRow[],
): FeedAttribute[] => {
  const attributes: FeedAttribute[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const name = feedAttributeName(row)

    if (!name || seen.has(name)) continue

    const value = resolveMappingValue(product, row)

    if (!value) continue

    seen.add(name)
    attributes.push({ name, value })
  }

  return attributes
}

/** Does this item carry a manufacturer identifier (GTIN/MPN)? */
export const hasIdentifier = (attributes: FeedAttribute[]): boolean =>
  attributes.some((attribute) => attribute.name === 'g:gtin' || attribute.name === 'g:mpn')
