import type { CollectionBeforeOperationHook, CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { adminOnly } from '@/access/adminOnly'
import { isOptimizableImage, optimizeImageBuffer, toWebpFilename } from '@/lib/imageOptimize'
import { isTranscodableVideo, toMp4Filename, transcodeVideoBuffer } from '@/lib/videoTranscode'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const formatKb = (bytes: number): string => `${Math.round(bytes / 1024)} kB`

/**
 * Automatická optimalizácia KAŽDÉHO nahraného súboru (Z9).
 *
 * Sedí na `beforeOperation`, teda pred `generateFileData` — v tom momente je
 * `req.file` ešte obyčajný buffer v pamäti a všetko, čo nasleduje (rozmery,
 * `filesize`, názov súboru, zápis na disk aj upload do Vercel Blobu), sa
 * odvodí až z neho. To je dôvod, prečo je hook tu a nie v `afterChange`:
 * po uložení už súbor leží v úložisku a jeho výmena by znamenala druhý
 * upload + prepis URL (pri Blobe navyše osirený starý objekt).
 *
 * Čo sa deje:
 *   - fotky (JPEG/PNG/TIFF/AVIF/HEIC) → WebP q82, max 2560 px, bez EXIF,
 *   - už nahraté WebP → nechá sa, iba príliš veľké sa zmenší,
 *   - SVG a GIF → nedotknuté (vektor sa nesmie rasterizovať, GIF je animácia),
 *   - videá > 1,5 MB → H.264 MP4 CRF 23, max 1920 px, bez zvuku, faststart.
 *
 * Výsledok sa berie len vtedy, keď je menší než originál. Akákoľvek chyba
 * alebo timeout znamená „ulož originál“ — nahrávanie sa nikdy nezhodí.
 */
const optimizeUploadedFile: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args

  const file = req.file

  // `useTempFiles` nie je zapnuté (Payload default false), takže dáta chodia
  // ako buffer. Keby sa to raz zmenilo, zdrojom pravdy je temp súbor a tento
  // krok sa musí prepísať — dovtedy ho radšej preskočíme, než by sme ticho
  // optimalizovali buffer, ktorý sa neuloží.
  if (!file || !file.data?.length || file.tempFilePath) return args

  const { logger } = req.payload
  const originalSize = file.data.length

  if (isOptimizableImage(file.mimetype)) {
    const optimized = await optimizeImageBuffer(file.data, file.mimetype, logger)

    if (optimized) {
      req.file = {
        ...file,
        data: optimized.data,
        mimetype: optimized.mimeType,
        name: toWebpFilename(file.name),
        size: optimized.data.length,
      }

      logger.info(
        `Médiá: ${file.name} ${formatKb(originalSize)} → WebP ${formatKb(optimized.data.length)} (−${Math.round(
          (1 - optimized.data.length / originalSize) * 100,
        )} %), ${optimized.width}×${optimized.height}.`,
      )
    }

    return args
  }

  if (isTranscodableVideo(file.mimetype)) {
    const transcoded = await transcodeVideoBuffer(file.data, file.mimetype, logger)

    if (transcoded) {
      req.file = {
        ...file,
        data: transcoded.data,
        mimetype: transcoded.mimeType,
        name: toMp4Filename(file.name),
        size: transcoded.data.length,
      }

      logger.info(
        `Médiá: ${file.name} ${formatKb(originalSize)} → MP4 ${formatKb(transcoded.data.length)} (−${Math.round(
          (1 - transcoded.data.length / originalSize) * 100,
        )} %), bez zvuku.`,
      )
    }
  }

  return args
}

export const Media: CollectionConfig = {
  admin: {
    description:
      'Obrázky sa pri nahraní automaticky prekódujú na WebP (max 2560 px) a videá na MP4 H.264 (max 1920 px, bez zvuku). SVG a GIF zostávajú nedotknuté.',
    group: 'Content',
  },
  slug: 'media',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  hooks: {
    beforeOperation: [optimizeUploadedFile],
  },
  upload: {
    // Zámerne bez `mimeTypes`: zoznam by sa zmenil na whitelist a odrezal by
    // typy, ktoré sa dnes bežne nahrávajú (PDF a pod.). Payload aj tak blokuje
    // spustiteľné a skriptové formáty (`RESTRICTED_FILE_EXT_AND_TYPES`),
    // takže video/mp4, video/webm aj video/quicktime prejdú bez zmeny konfigu.
    //
    // `formatOptions`/`imageSizes` tu tiež nie sú — Payload ich vykoná len s
    // inštanciou sharpu v `buildConfig({ sharp })`, ktorú tento projekt
    // nepredáva. Optimalizáciu preto robí hook vyššie priamo nad bufferom.
    staticDir: path.resolve(dirname, '../../public/media'),
  },
}
