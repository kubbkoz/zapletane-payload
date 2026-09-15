'use client'

import { toast, useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import { CATEGORIES_EVENT } from '../ScraperJobControls'

import '../ScraperJobControls/scraperJob.scss'

/**
 * Výber kategórií zdrojového e-shopu (Z14).
 *
 * Toto je odpoveď na majiteľkinu požiadavku „nech si viem vybrať, čo sa
 * importuje". Panel „Ovládanie importu" najprv jednou požiadavkou stiahne
 * navigáciu zdroja a jedným volaním modelu preloží názvy kategórií; tu si z
 * nich majiteľka odklikne, čo chce, a uloží výber.
 *
 * **Prázdny výber = celý obchod.** Je to napísané nad zoznamom, lebo je to
 * jediná vec, ktorú z tohto UI nevidno: nezaškrtnuté políčka vyzerajú ako
 * „nič sa nenaimportuje", pričom znamenajú opak. Východiskom je celý katalóg,
 * výber je zúženie.
 *
 * Dáta prídu dvomi cestami — rovnaký vzor ako pri náhľadoch:
 *   - pri načítaní stránky z uloženého dokumentu (`useDocumentInfo().data`),
 *   - hneď po načítaní kategórií z DOM udalosti, ktorú pošle `ScraperJobControls`.
 *
 * Výber sa ukladá vlastným PATCH-om na dokument úlohy, nie tlačidlom „Uložiť"
 * celého formulára: `categoryMap` je v admine skryté pole (desiatky položiek
 * surového JSON), takže by ho formulár nemal čo poslať — a zároveň sa takto
 * neuloží nič iné, čo má majiteľka rozpísané vo formulári.
 */

const baseClass = 'zap-scraper-categories'

type Category = {
  name?: string
  productCountEstimate?: null | number
  selected?: boolean
  translatedName?: string
  url?: string
}

const asCategories = (value: unknown): Category[] =>
  Array.isArray(value)
    ? (value.filter(
        (entry) => entry && typeof entry === 'object' && typeof (entry as Category).url === 'string',
      ) as Category[])
    : []

export const ScraperJobCategories: React.FC = () => {
  const { data, id } = useDocumentInfo()

  const [categories, setCategories] = React.useState<Category[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    const doc = data as null | { categoryMap?: unknown }

    if (doc?.categoryMap) setCategories(asCategories(doc.categoryMap))
  }, [data])

  React.useEffect(() => {
    const handler = (event: Event) => {
      setCategories(asCategories((event as CustomEvent).detail))
    }

    window.addEventListener(CATEGORIES_EVENT, handler)

    return () => window.removeEventListener(CATEGORIES_EVENT, handler)
  }, [])

  const toggle = React.useCallback((url: string) => {
    setCategories((current) =>
      current.map((entry) => (entry.url === url ? { ...entry, selected: !entry.selected } : entry)),
    )
  }, [])

  const setAll = React.useCallback((selected: boolean) => {
    setCategories((current) => current.map((entry) => ({ ...entry, selected })))
  }, [])

  const save = React.useCallback(async () => {
    if (!id) return

    setSaving(true)

    try {
      const response = await fetch(`/api/scraper-jobs/${String(id)}`, {
        body: JSON.stringify({ categoryMap: categories }),
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      })

      if (!response.ok) throw new Error(`Server odpovedal ${response.status}.`)

      const chosen = categories.filter((entry) => entry.selected).length

      toast.success(
        chosen
          ? `Výber uložený — importovať sa bude ${chosen} kategórií.`
          : 'Výber uložený — importovať sa bude celý obchod.',
      )
    } catch (error) {
      toast.error(
        `Výber sa nepodarilo uložiť: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setSaving(false)
    }
  }, [categories, id])

  if (!categories.length) {
    return (
      <div className={baseClass}>
        <p className={`${baseClass}__empty`}>
          Zatiaľ žiadne kategórie. Klikni na „Načítať kategórie“ v paneli „Ovládanie importu“ vpravo
          — stiahne zoznam kategórií zo zdroja a preloží ich názvy do slovenčiny. Potom si tu
          vyberieš, čo sa má importovať.
        </p>
      </div>
    )
  }

  const chosen = categories.filter((entry) => entry.selected).length

  return (
    <div className={baseClass}>
      <h3 className={`${baseClass}__title`}>Kategórie zdroja ({categories.length})</h3>

      <p className={`${baseClass}__hint`}>
        Zaškrtni, čo chceš naimportovať. Keď nezaškrtneš nič, naimportuje sa{' '}
        <strong>celý obchod</strong>. Výber nezabudni uložiť — testovací beh aj import sa potom
        pozerajú len na vybrané kategórie.
      </p>

      <div className={`${baseClass}__toolbar`}>
        <button
          className="btn btn--style-secondary btn--size-small"
          onClick={() => setAll(true)}
          type="button"
        >
          Vybrať všetko
        </button>
        <button
          className="btn btn--style-secondary btn--size-small"
          onClick={() => setAll(false)}
          type="button"
        >
          Zrušiť výber
        </button>
        <button
          className="btn btn--style-primary btn--size-small"
          disabled={saving}
          onClick={save}
          type="button"
        >
          {saving ? 'Ukladám…' : 'Uložiť výber'}
        </button>
        <span className={`${baseClass}__count`}>
          {chosen ? `Vybraných: ${chosen}` : 'Nič nevybrané = celý obchod'}
        </span>
      </div>

      <ul className={`${baseClass}__grid`}>
        {categories.map((category) => {
          const url = category.url!
          const label = category.translatedName || category.name || url

          return (
            <li
              className={`${baseClass}__item${category.selected ? ` ${baseClass}__item--on` : ''}`}
              key={url}
            >
              <input
                checked={Boolean(category.selected)}
                id={`zap-cat-${url}`}
                onChange={() => toggle(url)}
                type="checkbox"
              />
              <label className={`${baseClass}__label`} htmlFor={`zap-cat-${url}`}>
                <span>
                  {label}
                  {typeof category.productCountEstimate === 'number'
                    ? ` (${category.productCountEstimate})`
                    : ''}
                </span>
                {category.name && category.name !== label ? (
                  <span className={`${baseClass}__original`}>{category.name}</span>
                ) : null}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ScraperJobCategories
