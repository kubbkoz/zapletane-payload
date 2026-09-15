'use client'

import { toast, useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import './scraperJob.scss'

/**
 * Ovládanie importu z webu (Z12) — bočný panel úlohy „Import z webu".
 *
 * Tri tlačidlá a jedno pravidlo: **slučku dávok riadi prehliadač.**
 * `/api/scraper/run` spracuje vždy len jednu dávku (serverless strop 60 s),
 * takže „Potvrdiť a importovať všetko" volá tú istú adresu dookola, kým
 * odpoveď nepovie `done` — a medzitým priebežne ukazuje počítadlá. Preto sa
 * dá import aj zastaviť: stačí prestať volať.
 *
 * Prečo sa po behu nerobí `router.refresh()`: formulár dokumentu je klientský
 * a refresh by prepísal rozpísané polia. Náhľady sa preto posielajú sesterskému
 * komponentu (`ScraperJobPreviews`) obyčajnou DOM udalosťou a počítadlá si
 * komponent drží sám — uložený dokument je aj tak zdroj pravdy po najbližšom
 * načítaní stránky.
 */

const ENDPOINT = '/api/scraper/run'

/** Musí sedieť s odberateľom v `ScraperJobPreviews`. */
export const PREVIEWS_EVENT = 'zapletane:scraper-previews'

type Counters = {
  discovered?: number
  failed?: number
  imported?: number
  skipped?: number
}

type RunResponse = {
  counters?: Counters
  done?: boolean
  message?: string
  ok?: boolean
  previews?: unknown
  remaining?: number
  status?: string
  total?: number
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_confirm: 'Čaká na potvrdenie',
  done: 'Hotovo',
  failed: 'Chyba',
  importing: 'Importuje sa',
  new: 'Nový',
  preview_running: 'Testovací beh',
}

const baseClass = 'zap-scraper'

export const ScraperJobControls: React.FC = () => {
  const { data, id } = useDocumentInfo()

  const [busy, setBusy] = React.useState<'' | 'batch' | 'preview'>('')
  const [counters, setCounters] = React.useState<Counters>({})
  const [progress, setProgress] = React.useState<null | string>(null)
  const [status, setStatus] = React.useState<null | string>(null)

  // `stopRef` namiesto stavu: slučka beží v jednej async funkcii, ktorá by
  // zmenu stavu nikdy neuvidela (uzavrela by si starú hodnotu).
  const stopRef = React.useRef(false)

  React.useEffect(() => {
    const doc = data as null | { counters?: Counters; status?: string }

    if (doc?.counters) setCounters(doc.counters)
    if (doc?.status) setStatus(doc.status)
  }, [data])

  const call = React.useCallback(
    async (mode: 'batch' | 'preview'): Promise<RunResponse> => {
      const response = await fetch(ENDPOINT, {
        body: JSON.stringify({ jobId: id, mode }),
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })

      const payload = (await response.json().catch(() => ({}))) as RunResponse

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || `Server odpovedal ${response.status}.`)
      }

      return payload
    },
    [id],
  )

  const runPreview = React.useCallback(async () => {
    setBusy('preview')
    setProgress('Hľadám produkty na zadanej adrese…')

    try {
      const result = await call('preview')

      if (result.counters) setCounters(result.counters)
      if (result.status) setStatus(result.status)

      const previews = Array.isArray(result.previews) ? result.previews : []

      window.dispatchEvent(new CustomEvent(PREVIEWS_EVENT, { detail: previews }))

      setProgress(`Testovací beh hotový — ${previews.length} náhľadov nižšie.`)
      toast.success(`Testovací beh hotový: ${previews.length} produktov na ukážku.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      setStatus('failed')
      toast.error(`Testovací beh zlyhal: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call])

  const runAllBatches = React.useCallback(async () => {
    stopRef.current = false
    setBusy('batch')
    setProgress('Spúšťam import…')

    try {
      for (;;) {
        if (stopRef.current) {
          setProgress('Zastavené. Import môžeš kedykoľvek pustiť ďalej — pokračuje tam, kde skončil.')
          toast.message('Import zastavený.')
          break
        }

        const result = await call('batch')

        if (result.counters) setCounters(result.counters)
        if (result.status) setStatus(result.status)

        const total = result.total ?? result.counters?.discovered ?? 0
        const doneCount =
          (result.counters?.imported ?? 0) +
          (result.counters?.skipped ?? 0) +
          (result.counters?.failed ?? 0)

        setProgress(
          result.done
            ? `Import dokončený — spracovaných ${doneCount} z ${total}.`
            : `Spracované ${doneCount} z ${total}, pokračujem…`,
        )

        if (result.done) {
          toast.success('Import dokončený.')
          break
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      setStatus('failed')
      toast.error(`Import zlyhal: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call])

  if (!id) {
    return (
      <div className={baseClass}>
        <p className={`${baseClass}__hint`}>
          Zadaj adresu obchodu a ulož — tlačidlá sa objavia po prvom uložení.
        </p>
      </div>
    )
  }

  const running = busy !== ''

  return (
    <div className={baseClass}>
      <p className={`${baseClass}__hint`}>
        Najprv testovací beh (3 produkty na ukážku), potom import všetkého po dávkach. Import sa dá
        kedykoľvek zastaviť a znovu spustiť — už stiahnuté produkty preskočí.
      </p>

      <button
        className={`btn btn--style-primary btn--size-small ${baseClass}__btn`}
        disabled={running}
        onClick={runPreview}
        type="button"
      >
        {busy === 'preview' ? 'Prebieha testovací beh…' : 'Spustiť testovací beh'}
      </button>

      <button
        className={`btn btn--style-secondary btn--size-small ${baseClass}__btn`}
        disabled={running}
        onClick={runAllBatches}
        type="button"
      >
        {busy === 'batch' ? 'Importujem…' : 'Potvrdiť a importovať všetko'}
      </button>

      <button
        className={`btn btn--style-secondary btn--size-small ${baseClass}__btn`}
        disabled={busy !== 'batch'}
        onClick={() => {
          stopRef.current = true
          setProgress('Zastavujem po dobehnutí aktuálnej dávky…')
        }}
        type="button"
      >
        Zastaviť
      </button>

      {status ? (
        <p className={`${baseClass}__status`}>
          Stav: <strong>{STATUS_LABELS[status] ?? status}</strong>
        </p>
      ) : null}

      {progress ? <p className={`${baseClass}__progress`}>{progress}</p> : null}

      <ul className={`${baseClass}__counters`}>
        <li>
          Nájdené: <strong>{counters.discovered ?? 0}</strong>
        </li>
        <li>
          Naimportované: <strong>{counters.imported ?? 0}</strong>
        </li>
        <li>
          Preskočené: <strong>{counters.skipped ?? 0}</strong>
        </li>
        <li>
          Chyby: <strong>{counters.failed ?? 0}</strong>
        </li>
      </ul>
    </div>
  )
}

export default ScraperJobControls
