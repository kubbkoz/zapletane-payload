import type { ScraperJob } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { hasInternalToken, isHeartbeatStale, kickBatch, STALE_HEARTBEAT_MS } from '@/scraper/chain'

/**
 * GET /api/scraper/tick — záchranný beh pre padnuté reťaze importu (Z14).
 *
 * Import sa od Z14 reťazí sám: dávka si po sebe zavolá ďalšiu. Reťaz je ale
 * len reťaz — stačí jeden výpadok siete, reštart inštancie alebo timeout a
 * úloha ostane visieť v stave „importuje sa" bez toho, aby na nej niekto
 * robil. Bez tejto routy by to majiteľka zistila až tým, že sa počítadlá
 * prestali hýbať.
 *
 * Táto routa prejde úlohy v stave „importuje sa", a tie, ktorých tep
 * (`heartbeatAt`) je starší než `STALE_HEARTBEAT_MS`, kopne znova. Živé úlohy
 * nechá na pokoji — inak by na tej istej fronte vznikli dve reťaze.
 *
 * **Spúšťa ju `vercel.json` raz denne.** Denná frekvencia je zámerná: cron
 * s kratším intervalom je na Verceli vec tarifu a toto má fungovať na
 * ktoromkoľvek. Nie je to hlavný pohon importu (ten je reťaz), len poistka —
 * a kto má tarif na viac, môže si v `vercel.json` interval skrátiť.
 *
 * **Autorizácia.** `Authorization: Bearer …` buď s `CRON_SECRET` (to posiela
 * Vercel Cron sám), alebo s `SCRAPER_INTERNAL_TOKEN` (ručné spustenie).
 * Bez tajomstva by ktokoľvek zvonku vedel rozbehnúť sťahovanie a míňať kredit.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Koľko úloh sa v jednom behu skontroluje. Viac ich naraz nikdy nebeží. */
const MAX_JOBS = 20

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

const hasCronSecret = (headers: Headers): boolean => {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) return false

  const header = headers.get('authorization') ?? ''

  return header.replace(/^bearer\s+/i, '').trim() === secret
}

export async function GET(request: Request): Promise<Response> {
  if (!hasCronSecret(request.headers) && !hasInternalToken(request.headers)) {
    return json({ message: 'Prístup zamietnutý.', ok: false }, 403)
  }

  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'scraper-jobs',
    depth: 0,
    limit: MAX_JOBS,
    overrideAccess: true,
    pagination: false,
    sort: 'updatedAt',
    where: { status: { equals: 'importing' } },
  })

  const endpoint = new URL('/api/scraper/run', request.url).toString()
  const revived: Array<number | string> = []

  for (const doc of docs as ScraperJob[]) {
    if (!isHeartbeatStale(doc.heartbeatAt)) continue

    const outcome = await kickBatch({
      // Zámerne NIE reťazové volanie: reťaz sa už skončila a `expectCursor`
      // by len rozbil vlastnú kontrolu. Toto je nový začiatok, ktorý si route
      // sama overí proti tepu — a ten je práve preto starý.
      chain: false,
      endpoint,
      jobId: doc.id,
      onError: (message) => payload.logger.error(`[scraper/tick] Úloha ${String(doc.id)}: ${message}`),
    })

    if (outcome === 'handed-off') revived.push(doc.id)
  }

  payload.logger.info(
    `[scraper/tick] Skontrolovaných ${docs.length} úloh, rozbehnutých ${revived.length}.`,
  )

  return json({ checked: docs.length, ok: true, revived, staleAfterMs: STALE_HEARTBEAT_MS })
}
