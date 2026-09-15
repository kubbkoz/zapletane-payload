import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import ffmpegPath from 'ffmpeg-static'

/**
 * Automatická kompresia nahraných videí (Z9).
 *
 * Beží nad bufferom v `beforeOperation` hooku kolekcie `media`, teda ešte
 * pred tým, než sa súbor odovzdá úložisku. Vďaka tomu je výsledok rovnaký na
 * lokálnom disku aj vo Vercel Blobe — obe cesty dostanú už skomprimovaný
 * súbor, nič sa nerobí „dodatočne“ nad hotovým blobom (čo by pri Blobe
 * znamenalo druhý upload a prepis URL).
 *
 * Nastavenie zodpovedá tomu, na čo sa video v hero sekcii používa: krátka,
 * nemá slučka na pozadí. Preto:
 *   - H.264 (libx264) CRF 23 — vizuálne čisté, univerzálne prehrateľné,
 *   - `veryfast` preset — serverless funkcia má na to sekundy, nie minúty,
 *   - `-movflags +faststart` — moov atom na začiatok, video sa dá prehrávať
 *     hneď počas sťahovania,
 *   - `-an` — zvuk sa zahadzuje (hero video je vždy `muted`, stopa by len
 *     zaberala miesto),
 *   - šírka zhora orezaná na 1920 px (výška dopočítaná na párne číslo).
 *
 * Pravidlá bezpečia: prekódovanie NIKDY nezhodí nahrávanie. Timeout, chýbajúci
 * ffmpeg, nečitateľný vstup či väčší výstup = ticho sa uloží originál.
 */

/** Pod touto veľkosťou sa prekódovanie neoplatí (réžia > úspora). */
export const VIDEO_TRANSCODE_MIN_BYTES = 1_500_000

/** Tvrdý strop na beh ffmpegu — po ňom sa proces zabije a uloží sa originál. */
export const VIDEO_TRANSCODE_TIMEOUT_MS = 40_000

/** Horná hranica šírky výsledného videa. */
export const VIDEO_MAX_WIDTH = 1920

/** CRF 23 = predvolená „vizuálne bezstratová“ hranica x264 pre web. */
export const VIDEO_CRF = '23'

const TRANSCODABLE_MIME_TYPES = new Set([
  'video/mp4',
  'video/mpeg',
  'video/ogg',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/x-matroska',
  'video/x-msvideo',
])

export type TranscodedVideo = {
  data: Buffer
  /** Prípona bez bodky. */
  ext: 'mp4'
  mimeType: 'video/mp4'
}

export function isTranscodableVideo(mimeType: string): boolean {
  return TRANSCODABLE_MIME_TYPES.has(mimeType)
}

/** Prípona súboru sa vymení za `.mp4` (názov bez prípony zostáva). */
export function toMp4Filename(filename: string): string {
  const dot = filename.lastIndexOf('.')

  return `${dot > 0 ? filename.slice(0, dot) : filename}.mp4`
}

/** `DISABLE_VIDEO_TRANSCODE=1` vypne prekódovanie úplne (únikový poistný ventil). */
export function videoTranscodeDisabled(): boolean {
  return process.env.DISABLE_VIDEO_TRANSCODE === '1'
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      resolve({ ok: false, reason: 'ffmpeg binárka nie je k dispozícii' })
      return
    }

    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    let settled = false

    const finish = (result: { ok: boolean; reason?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, reason: `prekročený časový limit ${timeoutMs} ms` })
    }, timeoutMs)

    child.stderr?.on('data', (chunk: Buffer) => {
      // Len posledný kus stačí na diagnostiku; stderr videa vie byť dlhý.
      stderr = `${stderr}${chunk.toString()}`.slice(-2000)
    })

    child.on('error', (err) => {
      finish({ ok: false, reason: err.message })
    })

    child.on('close', (code) => {
      finish(
        code === 0 ? { ok: true } : { ok: false, reason: stderr.trim() || `ffmpeg kód ${code}` },
      )
    })
  })
}

/**
 * Vráti skomprimované MP4, alebo `null`, keď sa nemá čo meniť (vypnuté,
 * malý súbor, nepodporovaný typ, chyba, timeout alebo väčší výsledok).
 */
export async function transcodeVideoBuffer(
  input: Buffer,
  mimeType: string,
  logger?: { info?: (msg: string) => void; warn: (msg: string) => void },
): Promise<null | TranscodedVideo> {
  if (videoTranscodeDisabled()) return null
  if (!isTranscodableVideo(mimeType)) return null
  if (input.length < VIDEO_TRANSCODE_MIN_BYTES) return null

  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    logger?.warn('Prekódovanie videa preskočené: ffmpeg binárka sa nenašla, ukladám originál.')
    return null
  }

  let dir: null | string = null

  try {
    dir = await mkdtemp(path.join(tmpdir(), 'zapletane-video-'))

    const inputPath = path.join(dir, 'source')
    const outputPath = path.join(dir, 'optimized.mp4')

    await writeFile(inputPath, input)

    const result = await runFfmpeg(
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputPath,
        '-vf',
        `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
        '-c:v',
        'libx264',
        '-crf',
        VIDEO_CRF,
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-an',
        outputPath,
      ],
      VIDEO_TRANSCODE_TIMEOUT_MS,
    )

    if (!result.ok) {
      logger?.warn(`Prekódovanie videa zlyhalo (${result.reason}) — ukladám originál.`)
      return null
    }

    const output = await readFile(outputPath)

    if (output.length >= input.length) {
      logger?.info?.(
        `Prekódované video nie je menšie (${output.length} B vs ${input.length} B) — ukladám originál.`,
      )
      return null
    }

    return { data: output, ext: 'mp4', mimeType: 'video/mp4' }
  } catch (err) {
    logger?.warn(
      `Prekódovanie videa zlyhalo, ukladám originál: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )

    return null
  } finally {
    if (dir) {
      await rm(dir, { force: true, recursive: true }).catch(() => undefined)
    }
  }
}
