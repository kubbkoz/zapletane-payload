'use client'

import { toast, useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import './scraperJob.scss'

/**
 * Ovládanie importu z webu (Z12, prepísané Z14) — bočný panel úlohy.
 *
 * **Zmena oproti Z12: slučku dávok už neriadi prehliadač.** Predtým sa
 * `/api/scraper/run` volalo dookola z tejto komponenty, takže zavretá karta
 * import zastavila. Teraz sa raz kopne (`mode: 'batch'`) a server si ďalšie
 * dávky reťazí sám; prehliadač len každých pár sekúnd načíta dokument úlohy a
 * prekreslí počítadlá. Zavretie karty preto na nič nevplýva a „Zastaviť" nie
 * je „prestanem volať", ale požiadavka, ktorá stav úlohy naozaj prepne.
 *
 * Poradie tlačidiel zodpovedá poradiu krokov: kategórie → testovací beh →
 * import. „Pokračovať" sa ukáže len vtedy, keď je čo pokračovať — po zastavení
 * alebo keď je úloha v stave „importuje sa", ale posledná dávka dobehla pred
 * viac než troma minútami (spadnutá reťaz).
 *
 * Prečo sa po behu nerobí `router.refresh()`: formulár dokumentu je klientský
 * a refresh by prepísal rozpísané polia. Náhľady a kategórie sa preto posielajú
 * sesterským komponentom obyčajnou DOM udalosťou a počítadlá si komponent drží
 * sám — uložený dokument je aj tak zdroj pravdy po najbližšom načítaní stránky.
 */

const ENDPOINT = '/api/scraper/run'

/** Musí sedieť s odberateľom v `ScraperJobPreviews`. */
export const PREVIEWS_EVENT = 'zapletane:scraper-previews'

/** Musí sedieť s odberateľom v `ScraperJobCategories`. */
export const CATEGORIES_EVENT = 'zapletane:scraper-categories'

/** Ako často sa počas importu načítava stav úlohy. */
const POLL_INTERVAL_MS = 5_000

/** Po akom tichu sa reťaz považuje za padnutú — zrkadlí `STALE_HEARTBEAT_MS`. */
const STALE_HEARTBEAT_MS = 3 * 60 * 1_000

type Counters = {
  discovered?: number
  failed?: number
  imported?: number
  skipped?: number
  skippedExisting?: number
}

type JobSnapshot = {
  counters: Counters
  heartbeatAt: null | string
  status: null | string
}

type RunResponse = {
  alreadyRunning?: boolean
  categories?: unknown
  chained?: boolean
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
  categories_ready: 'Kategórie načítané',
  done: 'Hotovo',
  failed: 'Chyba',
  importing: 'Importuje sa',
  new: 'Nový',
  preview_running: 'Testovací beh',
  stopped: 'Zastavené',
}

const baseClass = 'zap-scraper'

const isStale = (heartbeatAt: null | string): boolean => {
  if (!heartbeatAt) return true

  const at = Date.parse(heartbeatAt)

  return !Number.isFinite(at) || Date.now() - at > STALE_HEARTBEAT_MS
}

export const ScraperJobControls: React.FC = () => {
  const { data, id } = useDocumentInfo()

  const [busy, setBusy] = React.useState<'' | 'batch' | 'categories' | 'preview' | 'stop'>('')
  const [snapshot, setSnapshot] = React.useState<JobSnapshot>({
    counters: {},
    heartbeatAt: null,
    status: null,
  })
  const [progress, setProgress] = React.useState<null | string>(null)

  React.useEffect(() => {
    const doc = data as null | {
      counters?: Counters
      heartbeatAt?: null | string
      status?: string
    }

    if (!doc) return

    setSnapshot({
      counters: doc.counters ?? {},
      heartbeatAt: doc.heartbeatAt ?? null,
      status: doc.status ?? null,
    })
  }, [data])

  const call = React.useCallback(
    async (mode: 'batch' | 'categories' | 'preview' | 'stop'): Promise<RunResponse> => {
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

  /**
   * Načíta aktuálny stav úlohy.
   *
   * Toto je celá „slučka" na strane prehliadača — nič neriadi, len sa pozerá.
   * Preto sa aj zavretie karty prejaví iba tým, že sa nikto nepozerá.
   */
  const refresh = React.useCallback(async (): Promise<JobSnapshot | null> => {
    if (!id) return null

    try {
      const response = await fetch(`/api/scraper-jobs/${String(id)}?depth=0`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) return null

      const doc = (await response.json()) as {
        counters?: Counters
        heartbeatAt?: null | string
        status?: string
      }

      const next: JobSnapshot = {
        counters: doc.counters ?? {},
        heartbeatAt: doc.heartbeatAt ?? null,
        status: doc.status ?? null,
      }

      setSnapshot(next)

      return next
    } catch {
      return null
    }
  }, [id])

  // Počas importu sa stav ťahá periodicky. Interval sa ruší hneď, ako úloha
  // prestane byť v behu, aby otvorená karta zbytočne nebúchala na server.
  React.useEffect(() => {
    if (snapshot.status !== 'importing') return

    const timer = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [refresh, snapshot.status])

  const loadCategories = React.useCallback(async () => {
    setBusy('categories')
    setProgress('Načítavam kategórie zo zdroja…')

    try {
      const result = await call('categories')
      const categories = Array.isArray(result.categories) ? result.categories : []

      window.dispatchEvent(new CustomEvent(CATEGORIES_EVENT, { detail: categories }))

      if (result.status) setSnapshot((current) => ({ ...current, status: result.status! }))

      setProgress(
        categories.length
          ? `Načítaných ${categories.length} kategórií — vyber si ich nižšie.`
          : 'Na zdroji sa nenašli kategórie — import pôjde cez celý obchod.',
      )
      toast.success(`Kategórie načítané: ${categories.length}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      toast.error(`Načítanie kategórií zlyhalo: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call])

  const runPreview = React.useCallback(async () => {
    setBusy('preview')
    setProgress('Hľadám produkty na zadanej adrese…')

    try {
      const result = await call('preview')

      if (result.counters) setSnapshot((current) => ({ ...current, counters: result.counters! }))
      if (result.status) setSnapshot((current) => ({ ...current, status: result.status! }))

      const previews = Array.isArray(result.previews) ? result.previews : []

      window.dispatchEvent(new CustomEvent(PREVIEWS_EVENT, { detail: previews }))

      setProgress(`Testovací beh hotový — ${previews.length} náhľadov nižšie.`)
      toast.success(`Testovací beh hotový: ${previews.length} produktov na ukážku.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      setSnapshot((current) => ({ ...current, status: 'failed' }))
      toast.error(`Testovací beh zlyhal: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call])

  /**
   * Kopne import a ďalej sa už len pozerá.
   *
   * Jedno volanie, žiadna slučka: ďalšie dávky si objednáva server sám
   * (`src/scraper/chain.ts`). Keď server odpovie `chained: false` a import
   * nie je hotový, znamená to, že reťazenie nie je nastavené (chýba
   * `SCRAPER_INTERNAL_TOKEN`) — vtedy je na mieste to majiteľke povedať,
   * nie ticho čakať na počítadlá, ktoré sa nepohnú.
   */
  const startImport = React.useCallback(async () => {
    setBusy('batch')
    setProgress('Spúšťam import…')

    try {
      const result = await call('batch')

      if (result.counters) setSnapshot((current) => ({ ...current, counters: result.counters! }))

      await refresh()

      if (result.alreadyRunning) {
        setProgress('Import už beží — nechaj ho dobehnúť, kartu môžeš zavrieť.')
        toast.message('Import už beží.')
      } else if (result.done) {
        setProgress('Import dokončený.')
        toast.success('Import dokončený.')
      } else if (result.chained) {
        setProgress('Import beží na serveri. Kartu môžeš pokojne zavrieť — dobehne aj bez teba.')
        toast.success('Import spustený, pokračuje na serveri.')
      } else {
        setProgress(
          'Prvá dávka hotová, ale server si ďalšiu neobjednal. Skontroluj premennú SCRAPER_INTERNAL_TOKEN a pokračuj tlačidlom „Pokračovať“.',
        )
        toast.warning('Import pokračuje len ručne — chýba nastavenie reťazenia.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      setSnapshot((current) => ({ ...current, status: 'failed' }))
      toast.error(`Import zlyhal: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call, refresh])

  const stopImport = React.useCallback(async () => {
    setBusy('stop')

    try {
      await call('stop')
      await refresh()

      setProgress('Zastavené. Import môžeš kedykoľvek pustiť ďalej — pokračuje tam, kde skončil.')
      toast.message('Import zastavený.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setProgress(`Chyba: ${message}`)
      toast.error(`Zastavenie zlyhalo: ${message}`)
    } finally {
      setBusy('')
    }
  }, [call, refresh])

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
  const importing = snapshot.status === 'importing'
  const chainDead = importing && isStale(snapshot.heartbeatAt)
  const canResume = snapshot.status === 'stopped' || chainDead

  return (
    <div className={baseClass}>
      <p className={`${baseClass}__hint`}>
        Najprv načítaj kategórie a vyber si, čo chceš. Potom testovací beh (3 produkty na ukážku) a
        nakoniec import. Import beží na serveri — kartu môžeš zavrieť aj vypnúť počítač.
      </p>

      <button
        className={`btn btn--style-primary btn--size-small ${baseClass}__btn`}
        disabled={running}
        onClick={loadCategories}
        type="button"
      >
        {busy === 'categories' ? 'Načítavam kategórie…' : 'Načítať kategórie'}
      </button>

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
        disabled={running || importing}
        onClick={startImport}
        type="button"
      >
        {busy === 'batch' ? 'Spúšťam…' : 'Potvrdiť a importovať'}
      </button>

      <button
        className={`btn btn--style-secondary btn--size-small ${baseClass}__btn`}
        disabled={running || !importing}
        onClick={stopImport}
        type="button"
      >
        {busy === 'stop' ? 'Zastavujem…' : 'Zastaviť'}
      </button>

      {canResume ? (
        <button
          className={`btn btn--style-secondary btn--size-small ${baseClass}__btn`}
          disabled={running}
          onClick={startImport}
          type="button"
        >
          Pokračovať
        </button>
      ) : null}

      {chainDead ? (
        <p className={`${baseClass}__progress`}>
          Posledná dávka dobehla pred viac než troma minútami — import sa asi prerušil. Klikni na
          „Pokračovať“; nič sa nestratí, naväzuje sa tam, kde skončil.
        </p>
      ) : null}

      {snapshot.status ? (
        <p className={`${baseClass}__status`}>
          Stav: <strong>{STATUS_LABELS[snapshot.status] ?? snapshot.status}</strong>
        </p>
      ) : null}

      {progress ? <p className={`${baseClass}__progress`}>{progress}</p> : null}

      <ul className={`${baseClass}__counters`}>
        <li>
          Nájdené: <strong>{snapshot.counters.discovered ?? 0}</strong>
        </li>
        <li>
          Naimportované: <strong>{snapshot.counters.imported ?? 0}</strong>
        </li>
        <li>
          Preskočené: <strong>{snapshot.counters.skipped ?? 0}</strong>
        </li>
        <li>
          Už v obchode: <strong>{snapshot.counters.skippedExisting ?? 0}</strong>
        </li>
        <li>
          Chyby: <strong>{snapshot.counters.failed ?? 0}</strong>
        </li>
      </ul>
    </div>
  )
}

export default ScraperJobControls
