import sharp from 'sharp'

/**
 * Automatická optimalizácia obrázkov pri nahrávaní (Z9).
 *
 * Prečo vlastný krok a nie `upload.formatOptions` / `upload.imageSizes`:
 * Payload spúšťa sharp iba vtedy, keď dostane jeho inštanciu cez
 * `buildConfig({ sharp })` — a `src/payload.config.ts` ju má zámerne
 * zakomentovanú (`// sharp,`). Bez nej sú `formatOptions` aj `imageSizes`
 * ticho mŕtve: `generateFileData` ich preskočí a `imageSizes` by len pridali
 * prázdne stĺpce do schémy. Tento modul preto robí to isté priamo nad
 * bufferom, ešte pred tým, než sa súbor uloží — a funguje rovnako na disku
 * aj cez `@payloadcms/storage-vercel-blob`, lebo obe cesty čítajú až
 * `req.file` po tomto kroku.
 *
 * Princíp: „maximálna úspora bez viditeľnej straty kvality“ —
 *   - WebP q82/effort 5 je pri fotkách vizuálne nerozoznateľné od JPEG q90+,
 *     ale typicky o 60–80 % menšie,
 *   - rozmer sa zhora oreže na 2560 px (nikdy sa nezväčšuje) — väčšie fotky
 *     nemá kde zobraziť ani retina displej, `next/image` si z originálu
 *     dogeneruje menšie varianty sám,
 *   - EXIF/GPS metadáta sharp bez `withMetadata()` zahodí (súkromie + bajty),
 *     orientácia sa pred tým aplikuje cez `.rotate()`.
 */

/** Horná hranica dlhšej strany. Väčšie fotky sa zmenšujú, menšie nikdy. */
export const IMAGE_MAX_WIDTH = 2560

/** WebP kvalita — vizuálne bezstratová hranica pre fotografie. */
export const IMAGE_WEBP_QUALITY = 82

/** WebP `effort` 0–6; 5 je dobrý pomer čas/veľkosť pre server. */
export const IMAGE_WEBP_EFFORT = 5

/**
 * Formáty, ktoré prekódujeme do WebP.
 *
 * `image/svg+xml` a `image/gif` tu zámerne NIE sú: SVG by sharp
 * rasterizoval (vektor by sa nenávratne stratil) a GIF je takmer vždy
 * animovaný — prechádzajú bajt po bajte nezmenené.
 */
const CONVERTIBLE_MIME_TYPES = new Set([
  'image/avif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
])

/** WebP vstup: prekóduje sa len ak je obrázok väčší než `IMAGE_MAX_WIDTH`. */
const WEBP_MIME_TYPE = 'image/webp'

export type OptimizedImage = {
  data: Buffer
  height: number
  mimeType: 'image/webp'
  /** Prípona bez bodky. */
  ext: 'webp'
  width: number
}

/** Prípona súboru sa vymení za `.webp` (názov bez prípony zostáva). */
export function toWebpFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')

  return `${dot > 0 ? filename.slice(0, dot) : filename}.webp`
}

export function isOptimizableImage(mimeType: string): boolean {
  return CONVERTIBLE_MIME_TYPES.has(mimeType) || mimeType === WEBP_MIME_TYPE
}

/**
 * Vráti optimalizovaný WebP buffer, alebo `null`, keď sa optimalizácia
 * neoplatí (animácia, už malý WebP, výsledok by bol väčší) alebo keď
 * formát nechávame naschvál na pokoji (SVG, GIF).
 *
 * Nikdy nehádže — zlyhanie znamená „nechaj originál“, aby sa nahrávanie
 * nedalo zhodiť poškodeným súborom.
 */
export async function optimizeImageBuffer(
  input: Buffer,
  mimeType: string,
  logger?: { warn: (msg: string) => void },
): Promise<null | OptimizedImage> {
  if (!isOptimizableImage(mimeType)) return null

  try {
    // `failOn: 'none'` — mierne poškodený, ale zobraziteľný súbor nemá zhodiť upload.
    const metadata = await sharp(input, { failOn: 'none' }).metadata()

    // Animované WebP/TIFF (viac strán) necháme tak: prekódovanie na statický
    // snímok by tichu zmazalo animáciu.
    if (typeof metadata.pages === 'number' && metadata.pages > 1) return null

    const width = metadata.width ?? 0
    const needsResize = width > IMAGE_MAX_WIDTH

    // Už nahraný WebP v rozumnom rozmere: druhé kódovanie by len ubralo
    // kvalitu za pár bajtov.
    if (mimeType === WEBP_MIME_TYPE && !needsResize) return null

    let pipeline = sharp(input, { failOn: 'none' }).rotate()

    if (needsResize) {
      pipeline = pipeline.resize({
        fit: 'inside',
        width: IMAGE_MAX_WIDTH,
        withoutEnlargement: true,
      })
    }

    const output = await pipeline
      .webp({ effort: IMAGE_WEBP_EFFORT, quality: IMAGE_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    // Nikdy nezväčšovať: pri malých PNG s priehľadnosťou vie byť WebP väčší.
    // Ak sme však museli zmenšiť rozmer, väčší súbor je aj tak vylúčený.
    if (!needsResize && output.data.length >= input.length) return null

    return {
      data: output.data,
      ext: 'webp',
      height: output.info.height,
      mimeType: 'image/webp',
      width: output.info.width,
    }
  } catch (err) {
    logger?.warn(
      `Optimalizácia obrázka zlyhala (${mimeType}), ukladám originál: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )

    return null
  }
}
