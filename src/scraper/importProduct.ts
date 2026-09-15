/**
 * Zápis naskenovaného produktu do Payloadu (Z12).
 *
 * Idempotencia stojí na `products.importSource.url`: pred každým založením sa
 * pozrie, či produkt z tejto adresy už neexistuje, a ak áno, nič sa nedeje
 * (počíta sa ako „preskočený"). Kľúčom je *adresa*, nie názov ani SKU — názov
 * sa po preklade mení a SKU cudzí e-shop nemusí mať vôbec, kým adresa je
 * jediná vec, ktorá produkt v zdroji jednoznačne identifikuje.
 *
 * Čo import zámerne NEROBÍ:
 *   - neoptimalizuje obrázky (robí to `beforeOperation` hook v `media` — Z9),
 *   - nevypĺňa SEO meta (robí to `beforeChange` hook v `products` — Z4),
 *   - nedopĺňa slug (robí to `slugField` — Z7),
 *   - nenastavuje `inventory` (produkty sú „na objednávku", teda netrackované),
 *     s výnimkou zdroja, ktorý výslovne hlási vypredanie.
 *
 * Každý z týchto hookov už má vlastný časovač a vlastný pád, takže import
 * nemusí riešiť ich zlyhanie — stačí ich nechať bežať.
 */
import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import type { PreparedProduct, ScrapedProduct, TranslatedProduct } from './types'

import { formatSlug } from '@/utilities/formatSlug'

import { fetchBuffer, politeDelay } from './fetchPage'
import { imageCandidates, MAX_IMAGES } from './extract'
import { textToLexical } from './lexical'

export type ImportOutcome = {
  id?: number | string
  imagesImported?: number
  message: string
  productTitle: string
  status: 'created' | 'failed' | 'skipped'
}

export type ImportOptions = {
  /** Pauza medzi sťahovaním jednotlivých obrázkov z cudzieho servera. */
  politeDelayMs?: number
  req?: PayloadRequest
}

/**
 * Adresa z názvu — tá istá továreň, akú používa `slugField` aj
 * `product-properties`. Import ju dopočítava sám, lebo `categories.slug` je
 * povinné pole: hook `slugField` ho síce doplní, ale až vo `beforeValidate`,
 * takže by `payload.create` bez neho neprešiel typovou kontrolou. Kolízie
 * (dve kategórie s rovnakým názvom po preklade) rieši naďalej hook — pripojí
 * `-2`, `-3`, …
 */
const toSlug = (value: string): string => formatSlug(value)

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Názov súboru a MIME typ z adresy obrázka; oboje sa dá prebiť hlavičkou. */
const fileMetaFromUrl = (url: string, contentType: string): { mimetype: string; name: string } => {
  let pathname = ''

  try {
    pathname = new URL(url).pathname
  } catch {
    pathname = url
  }

  const base = pathname.split('/').filter(Boolean).pop() || 'obrazok'
  const extension = base.includes('.') ? base.split('.').pop()!.toLowerCase() : ''
  const fromHeader = contentType.split(';')[0]?.trim().toLowerCase() || ''

  const mimetype =
    (fromHeader.startsWith('image/') ? fromHeader : '') ||
    MIME_BY_EXTENSION[extension] ||
    'image/jpeg'

  return { mimetype, name: base.replace(/[^\w.-]+/g, '-').slice(0, 100) }
}

/**
 * Stiahne obrázok a založí `media`. Kandidáti sa skúšajú po rade (najvyššie
 * rozlíšenie prvé) — odvodená adresa originálu nemusí existovať, tak sa vždy
 * dá spadnúť na tú, ktorá bola v HTML.
 */
const importImage = async (
  payload: Payload,
  url: string,
  alt: string,
  options: ImportOptions,
): Promise<null | number | string> => {
  for (const candidate of imageCandidates(url)) {
    try {
      const { buffer, contentType } = await fetchBuffer(candidate)

      // Prázdna alebo podozrivo malá odpoveď = chybová stránka, nie fotka.
      if (buffer.length < 1_024) continue

      const { mimetype, name } = fileMetaFromUrl(candidate, contentType)

      const created = await payload.create({
        collection: 'media',
        data: { alt },
        file: { data: buffer, mimetype, name, size: buffer.length },
        req: options.req,
      })

      return created.id
    } catch {
      // Ďalší kandidát.
    }
  }

  return null
}

/** Nájde kategóriu podľa názvu (nezáleží na veľkosti písmen), inak ju založí. */
const findOrCreateCategory = async (
  payload: Payload,
  title: string,
  options: ImportOptions,
): Promise<null | number | string> => {
  const clean = title.trim()

  if (!clean) return null

  const slug = toSlug(clean)

  const existing = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req: options.req,
    where: slug ? { or: [{ title: { equals: clean } }, { slug: { equals: slug } }] } : { title: { equals: clean } },
  })

  if (existing.docs.length) return existing.docs[0]!.id

  const created = await payload.create({
    collection: 'categories',
    data: { slug: slug || clean, title: clean },
    req: options.req,
  })

  return created.id
}

/** To isté pre slovník vlastností (`product-properties`). */
const findOrCreateProperty = async (
  payload: Payload,
  name: string,
  options: ImportOptions,
): Promise<null | number | string> => {
  const clean = name.trim()

  if (!clean) return null

  const slug = toSlug(clean)

  const existing = await payload.find({
    collection: 'product-properties',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req: options.req,
    where: slug ? { or: [{ name: { equals: clean } }, { slug: { equals: slug } }] } : { name: { equals: clean } },
  })

  if (existing.docs.length) return existing.docs[0]!.id

  const created = await payload.create({
    collection: 'product-properties',
    data: { name: clean, slug },
    req: options.req,
  })

  return created.id
}

/** Bol už produkt z tejto adresy naimportovaný? */
export const findImportedProduct = async (
  payload: Payload,
  sourceUrl: string,
  options: ImportOptions = {},
): Promise<null | { id: number | string; title: string }> => {
  const { docs } = await payload.find({
    collection: 'products',
    depth: 0,
    draft: true,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req: options.req,
    where: { 'importSource.url': { equals: sourceUrl } },
  })

  const doc = docs[0]

  return doc ? { id: doc.id, title: doc.title } : null
}

/** Nedostupnosť v zdroji → `inventory: 0`; všetko ostatné → netrackované. */
const inventoryFromAvailability = (availability: null | string | undefined): null | number =>
  availability && /OutOfStock|SoldOut|Discontinued/i.test(availability) ? 0 : null

export const importProduct = async (
  payload: Payload,
  prepared: PreparedProduct,
  options: ImportOptions = {},
): Promise<ImportOutcome> => {
  const { priceInEUR, scraped, translated } = prepared
  const title = translated.title || scraped.title

  if (!title.trim()) {
    return {
      message: `Produkt ${scraped.sourceUrl} nemá názov — preskočený.`,
      productTitle: scraped.sourceUrl,
      status: 'failed',
    }
  }

  const existing = await findImportedProduct(payload, scraped.sourceUrl, options)

  if (existing) {
    return {
      id: existing.id,
      message: `Preskočené (už importované): ${existing.title}`,
      productTitle: title,
      status: 'skipped',
    }
  }

  try {
    // --- kategórie -------------------------------------------------------
    const categoryIds: Array<number | string> = []

    for (const name of translated.categoryPath.slice(0, 4)) {
      const id = await findOrCreateCategory(payload, name, options)

      if (id !== null && !categoryIds.includes(id)) categoryIds.push(id)
    }

    // --- obrázky ---------------------------------------------------------
    const gallery: Array<{ image: number | string }> = []

    for (const [index, url] of scraped.images.slice(0, MAX_IMAGES).entries()) {
      if (index > 0) await politeDelay(options.politeDelayMs)

      const mediaId = await importImage(payload, url, title, options)

      if (mediaId !== null) gallery.push({ image: mediaId })
    }

    // --- vlastnosti ------------------------------------------------------
    const properties: Array<{ property: number | string; value: string }> = []

    for (const attribute of translated.attributes.slice(0, 20)) {
      const propertyId = await findOrCreateProperty(payload, attribute.name, options)

      if (propertyId !== null) properties.push({ property: propertyId, value: attribute.value })
    }

    // --- samotný produkt --------------------------------------------------
    const description = textToLexical(translated.descriptionParagraphs)

    // Jedno `as` na celý objekt, nie osem malých: vzťahy sa tu odovzdávajú ako
    // holé id (`number | string`), kým `payload-types` ich má zapísané ako
    // `number | Media`, a `slug` doplní až hook `slugField`. Obsah je pritom
    // presne to, čo kolekcia očakáva — kontrolu spraví Payload pri validácii.
    const data = {
      // `_status` je zámerne 'published': majiteľka import potvrdila v
      // náhľade, takže držať produkty v koncepte by len znamenalo druhé
      // ručné publikovanie stoviek položiek.
      _status: 'published',
      ...(categoryIds.length ? { categories: categoryIds } : {}),
      ...(description ? { description } : {}),
      ...(gallery.length ? { gallery } : {}),
      importSource: {
        externalId: scraped.externalId || undefined,
        url: scraped.sourceUrl,
      },
      inventory: inventoryFromAvailability(scraped.availability),
      ...(properties.length ? { properties } : {}),
      ...(typeof priceInEUR === 'number'
        ? { priceInEUR, priceInEUREnabled: true }
        : { priceInEUREnabled: false }),
      title,
    } as unknown as RequiredDataFromCollectionSlug<'products'>

    const created = await payload.create({
      collection: 'products',
      data,
      req: options.req,
    })

    return {
      id: created.id,
      imagesImported: gallery.length,
      message: `Vytvorené: ${title} (${gallery.length} fotiek${
        typeof priceInEUR === 'number' ? `, ${(priceInEUR / 100).toFixed(2).replace('.', ',')} €` : ''
      })`,
      productTitle: title,
      status: 'created',
    }
  } catch (error) {
    return {
      message: `Chyba pri „${title}": ${error instanceof Error ? error.message : String(error)}`,
      productTitle: title,
      status: 'failed',
    }
  }
}

/** Pomocník pre náhľad — z naskenovaného + preloženého poskladá kartu. */
export const toPreview = (
  scraped: ScrapedProduct,
  translated: TranslatedProduct,
  priceInEUR: null | number,
): import('./types').ProductPreview => ({
  attributes: translated.attributes.slice(0, 8),
  categoryPath: translated.categoryPath,
  descriptionExcerpt: translated.descriptionParagraphs.join(' ').slice(0, 400),
  image: scraped.images[0] ?? null,
  originalPrice:
    scraped.priceAmount !== null
      ? `${scraped.priceAmount} ${scraped.priceCurrency ?? ''}`.trim()
      : null,
  originalTitle: scraped.title,
  priceInEUR,
  sku: scraped.sku,
  sourceUrl: scraped.sourceUrl,
  title: translated.title || scraped.title,
})
