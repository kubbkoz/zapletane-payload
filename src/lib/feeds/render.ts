import type { FeedAvailability, FeedItem, FeedPayload } from './types'

/** XML text escaping. `'` is escaped as `&apos;` for attribute safety too. */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const tag = (name: string, value: string, indent = '      '): string =>
  `${indent}<${name}>${escapeXml(value)}</${name}>`

/** `--` cannot appear inside an XML comment, and `>` ends it early. */
const comment = (text: string): string => `<!-- ${text.replace(/-{2,}/g, '-').replace(/>/g, '')} -->`

const buildNotes = (payload: FeedPayload): string[] => {
  const notes = [
    `ZAPLETANE product feed, generated ${payload.generatedAt}`,
    `${payload.items.length} item(s)`,
  ]

  if (payload.skippedNoImage > 0) {
    notes.push(
      `${payload.skippedNoImage} published product(s) skipped: no image. image_link is required by the feed spec, so an item without a gallery image cannot be listed.`,
    )
  }

  if (payload.skippedNoPrice > 0) {
    notes.push(`${payload.skippedNoPrice} published product(s) skipped: no price in EUR.`)
  }

  if (payload.truncated) {
    notes.push('Feed truncated at the 5000-item ceiling.')
  }

  return notes
}

/**
 * Google Merchant Center RSS 2.0 (https://support.google.com/merchant/answer/7052112).
 *
 * Channel-level `title`/`link`/`description` are plain RSS elements; every
 * item-level attribute is namespaced `g:` per the current spec. Meta's catalog
 * importer accepts exactly this document, which is why `meta-catalog.xml`
 * renders through the same function.
 */
export const renderGoogleXml = (payload: FeedPayload): string => {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    ...buildNotes(payload).map((note) => comment(note)),
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    tag('title', payload.storeName, '    '),
    tag('link', payload.siteUrl, '    '),
    tag('description', `Produktový katalóg ${payload.storeName}`, '    '),
    tag('lastBuildDate', new Date(payload.generatedAt).toUTCString(), '    '),
  ]

  for (const item of payload.items) {
    lines.push('    <item>')
    lines.push(tag('g:id', item.id))
    lines.push(tag('g:title', item.title))
    lines.push(tag('g:description', item.description))
    lines.push(tag('g:link', item.link))
    lines.push(tag('g:image_link', item.imageLink))

    for (const additional of item.additionalImageLinks) {
      lines.push(tag('g:additional_image_link', additional))
    }

    lines.push(tag('g:availability', item.availability))
    lines.push(tag('g:price', item.price))
    lines.push(tag('g:condition', item.condition))

    if (item.brand) lines.push(tag('g:brand', item.brand))
    if (item.googleProductCategory) {
      lines.push(tag('g:google_product_category', item.googleProductCategory))
    }

    // Google only wants to hear about identifiers when there are none: the
    // default is "yes", and an item that legitimately has no GTIN/MPN (a
    // handmade one-off, which is this whole catalog) has to say so explicitly.
    if (!item.identifierExists) lines.push(tag('g:identifier_exists', 'no'))

    for (const attribute of item.attributes) {
      lines.push(tag(attribute.name, attribute.value))
    }

    if (item.shipping) {
      lines.push('      <g:shipping>')
      lines.push(tag('g:country', item.shipping.country, '        '))
      lines.push(tag('g:price', item.shipping.price, '        '))
      lines.push('      </g:shipping>')
    }

    lines.push('    </item>')
  }

  lines.push('  </channel>', '</rss>', '')

  return lines.join('\n')
}

/**
 * Meta's CSV vocabulary differs from Google's in two places: the availability
 * values are spelled with spaces, and the dimensional attributes do not exist.
 */
const metaAvailability = (availability: FeedAvailability): string => {
  if (availability === 'in_stock') return 'in stock'
  if (availability === 'out_of_stock') return 'out of stock'

  return 'available for order'
}

/**
 * Google attribute -> Meta commerce column name. Anything not listed keeps its
 * bare name (the `g:` prefix stripped); Meta ignores columns it does not know,
 * so an unmapped extra costs nothing but is visible to whoever opens the file.
 */
const META_COLUMNS: Record<string, string> = {
  'g:product_weight': 'shipping_weight',
}

const metaColumnName = (attributeName: string): string =>
  META_COLUMNS[attributeName] ?? attributeName.replace(/^g:/, '')

const BASE_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
] as const

const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

/**
 * Meta commerce catalog CSV
 * (https://www.facebook.com/business/help/120325381656392).
 *
 * The nine required columns first, then the optional ones this shop can fill,
 * then one column per mapped attribute. The header is computed from the union
 * of the attributes present across all items, so every row has the same shape.
 *
 * The caller prefixes a UTF-8 BOM (see the route handler): without it Excel
 * mis-decodes „ž", „č" and the rest of the Slovak diacritics.
 */
export const renderMetaCsv = (payload: FeedPayload): string => {
  const extraColumns: string[] = []

  for (const item of payload.items) {
    for (const attribute of item.attributes) {
      const column = metaColumnName(attribute.name)

      if (!extraColumns.includes(column)) extraColumns.push(column)
    }
  }

  const hasCategory = payload.items.some((item) => Boolean(item.googleProductCategory))
  const hasShipping = payload.items.some((item) => Boolean(item.shipping))
  const hasAdditionalImages = payload.items.some((item) => item.additionalImageLinks.length > 0)

  const header = [
    ...BASE_COLUMNS,
    ...(hasCategory ? ['google_product_category'] : []),
    ...(hasAdditionalImages ? ['additional_image_link'] : []),
    ...(hasShipping ? ['shipping'] : []),
    ...extraColumns,
  ]

  const rows = [header.map(csvCell).join(',')]

  for (const item of payload.items) {
    const byColumn = new Map<string, string>()

    for (const attribute of item.attributes) {
      byColumn.set(metaColumnName(attribute.name), attribute.value)
    }

    const row: string[] = [
      item.id,
      item.title,
      item.description,
      metaAvailability(item.availability),
      item.condition,
      item.price,
      item.link,
      item.imageLink,
      item.brand,
    ]

    if (hasCategory) row.push(item.googleProductCategory)
    if (hasAdditionalImages) row.push(item.additionalImageLinks.join(','))
    // Meta's shipping column is `country:region:service:price`.
    if (hasShipping) row.push(item.shipping ? `${item.shipping.country}:::${item.shipping.price}` : '')

    for (const column of extraColumns) {
      row.push(byColumn.get(column) ?? '')
    }

    // A newline inside a quoted CSV cell is legal but trips naive parsers and
    // Meta's own importer; descriptions are the only multi-line field here.
    rows.push(row.map((cell) => csvCell(cell.replace(/\r?\n/g, ' '))).join(','))
  }

  return `${rows.join('\r\n')}\r\n`
}
