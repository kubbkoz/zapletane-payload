'use client'

import { toast, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React from 'react'

import './generateArticle.scss'

/**
 * „Vygenerovať článok" — bočný panel článku (Z15).
 *
 * Jedno tlačidlo a jedno pravidlo: **píše sa do konceptu, nikdy sa
 * nepublikuje.** Po úspešnom zápise sa stránka tvrdo načíta znova, aby
 * editor ukázal, čo model napísal. Bez reloadu by vo formulári ostali staré
 * (prázdne) hodnoty a autosave by vygenerovaný text pri najbližšej zmene
 * prepísal späť na prázdno.
 *
 * Reload je tu bezpečný práve preto, že články majú zapnutý autosave —
 * Payload pri autosave kolekciách nevykresľuje `LeaveWithoutSaving`, takže
 * žiadny `beforeunload` dialóg do cesty nevstúpi.
 *
 * Text zadania sa neberie z databázy, ale z rozpísaného formulára: majiteľka
 * ho môže prepísať a hneď kliknúť, bez čakania na autosave.
 */

const ENDPOINT = '/api/posts/generate'

/** Merané na `claude-sonnet-5`: 600–900 slov po slovensky trvá 60–90 s. */
const EXPECTED_HINT = 'Píšem článok… (~1–2 minúty)'

type GenerateResponse = {
  elapsedMs?: number
  message?: string
  ok?: boolean
  title?: string
  wordCount?: number
}

const baseClass = 'zap-article-ai'

export const GenerateArticleButton: React.FC = () => {
  const { id } = useDocumentInfo()

  // Selektor, nie celý formulár: prekresľuje sa len pri zmene tohto poľa.
  const prompt = useFormFields(([fields]) => {
    const value = fields?.aiPrompt?.value

    return typeof value === 'string' ? value : ''
  })

  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<null | string>(null)

  const trimmed = (prompt ?? '').trim()
  const missingDoc = !id
  const missingPrompt = trimmed.length < 5

  const generate = React.useCallback(async () => {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(ENDPOINT, {
        body: JSON.stringify({ postId: id, prompt: trimmed }),
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })

      const payload = (await response.json().catch(() => ({}))) as GenerateResponse

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || `Server odpovedal ${response.status}.`)
      }

      toast.success(`Článok „${payload.title}" je hotový (${payload.wordCount} slov).`)

      // Nech si stihne prečítať hlášku, než sa stránka načíta odznova.
      window.setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      setError(message)
      toast.error(`Článok sa nepodarilo vygenerovať: ${message}`)
      setBusy(false)
    }
  }, [id, trimmed])

  const hint = missingDoc
    ? 'Najprv uložte koncept — článok potrebuje existovať, aby doňho bolo možné písať.'
    : missingPrompt
      ? 'Vyplňte tému alebo pokyny vyššie.'
      : 'Zaberie to minútu až dve. Text sa uloží ako koncept — prečítajte si ho a publikujte až potom.'

  return (
    <div className={baseClass}>
      <button
        className={`btn btn--style-primary btn--size-small ${baseClass}__btn`}
        disabled={busy || missingDoc || missingPrompt}
        onClick={generate}
        type="button"
      >
        {busy ? (
          <span className={`${baseClass}__busy`}>
            <span aria-hidden="true" className={`${baseClass}__spinner`} />
            {EXPECTED_HINT}
          </span>
        ) : (
          'Vygenerovať článok'
        )}
      </button>

      <p className={`${baseClass}__hint`}>{hint}</p>

      {error ? (
        <p className={`${baseClass}__error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default GenerateArticleButton
