'use client'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

import { PREVIEWS_EVENT } from '../ScraperJobControls'

import '../ScraperJobControls/scraperJob.scss'

/**
 * Karty náhľadu z testovacieho behu (Z12).
 *
 * Toto je to miesto, kde majiteľka *rozhoduje*: vidí presne tri produkty tak,
 * ako budú po importe vyzerať — slovenský názov, slovenský popis, cena v
 * eurách zaokrúhlená na X,99, kategória a prvá fotka. Až potom klikne na
 * „Potvrdiť a importovať všetko" v bočnom paneli.
 *
 * Dáta prídu dvomi cestami:
 *   - pri načítaní stránky z uloženého poľa `previews` (`useFormFields`),
 *   - hneď po testovacom behu z DOM udalosti, ktorú pošle `ScraperJobControls`
 *     — bez nej by sa museli náhľady „vyklikať" uložením a znovunačítaním.
 *
 * Obrázok sa zobrazuje priamo zo zdrojového e-shopu (ešte nie je nič stiahnuté),
 * preto `<img>` a nie `next/image`: doména je zakaždým iná a do
 * `next.config.ts` sa dopredu zapísať nedá.
 */

const baseClass = 'zap-scraper-previews'

type PreviewAttribute = { name?: string; value?: string }

type Preview = {
  attributes?: PreviewAttribute[]
  categoryPath?: string[]
  descriptionExcerpt?: string
  image?: null | string
  originalPrice?: null | string
  originalTitle?: string
  priceInEUR?: null | number
  sku?: null | string
  sourceUrl?: string
  title?: string
}

const formatEur = (value: null | number | undefined): null | string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${(value / 100).toFixed(2).replace('.', ',')} €`
    : null

const asPreviews = (value: unknown): Preview[] =>
  Array.isArray(value) ? (value.filter((entry) => entry && typeof entry === 'object') as Preview[]) : []

export const ScraperJobPreviews: React.FC = () => {
  const stored = useFormFields(([fields]) => fields?.previews?.value)

  const [live, setLive] = React.useState<null | Preview[]>(null)

  // Fotka sa ťahá priamo z cudzieho e-shopu, takže sa nemusí načítať (hotlink
  // protection, sieť, medzitým zmazaný súbor). Bez tohto by v karte zostala
  // ikona rozbitého obrázka s alt textom cez pol karty.
  const [brokenImages, setBrokenImages] = React.useState<Record<string, true>>({})

  React.useEffect(() => {
    const handler = (event: Event) => {
      setLive(asPreviews((event as CustomEvent).detail))
    }

    window.addEventListener(PREVIEWS_EVENT, handler)

    return () => window.removeEventListener(PREVIEWS_EVENT, handler)
  }, [])

  const previews = live ?? asPreviews(stored)

  if (!previews.length) {
    return (
      <div className={baseClass}>
        <p className={`${baseClass}__empty`}>
          Zatiaľ žiadne náhľady. Spusti testovací beh v paneli „Ovládanie importu“ vpravo — stiahne
          tri produkty, preloží ich do slovenčiny a prepočíta ceny, aby si videla výsledok ešte pred
          importom.
        </p>
      </div>
    )
  }

  return (
    <div className={baseClass}>
      <h3 className={`${baseClass}__title`}>Takto budú produkty vyzerať ({previews.length})</h3>

      <div className={`${baseClass}__grid`}>
        {previews.map((preview, index) => {
          const price = formatEur(preview.priceInEUR)
          const showImage = preview.image && !brokenImages[preview.image]

          return (
            <article className={`${baseClass}__card`} key={preview.sourceUrl ?? index}>
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={preview.title ?? ''}
                  className={`${baseClass}__thumb`}
                  loading="lazy"
                  onError={() =>
                    setBrokenImages((current) => ({ ...current, [preview.image!]: true }))
                  }
                  src={preview.image!}
                />
              ) : (
                <div className={`${baseClass}__thumb ${baseClass}__thumb--empty`}>
                  {preview.image ? 'fotku sa nepodarilo načítať' : 'bez fotky'}
                </div>
              )}

              <div className={`${baseClass}__body`}>
                <h4 className={`${baseClass}__name`}>{preview.title}</h4>

                {preview.originalTitle && preview.originalTitle !== preview.title ? (
                  <p className={`${baseClass}__original`}>Originál: {preview.originalTitle}</p>
                ) : null}

                <p className={`${baseClass}__price`}>
                  {price ?? 'cena sa nenašla'}
                  {preview.originalPrice ? (
                    <span className={`${baseClass}__price-src`}> (pôvodne {preview.originalPrice})</span>
                  ) : null}
                </p>

                {preview.categoryPath?.length ? (
                  <p className={`${baseClass}__meta`}>Kategória: {preview.categoryPath.join(' › ')}</p>
                ) : null}

                {preview.sku ? <p className={`${baseClass}__meta`}>Kód: {preview.sku}</p> : null}

                {preview.descriptionExcerpt ? (
                  <p className={`${baseClass}__excerpt`}>{preview.descriptionExcerpt}</p>
                ) : null}

                {preview.attributes?.length ? (
                  <ul className={`${baseClass}__attrs`}>
                    {preview.attributes.map((attribute, attributeIndex) => (
                      <li key={`${attribute.name}-${attributeIndex}`}>
                        <span>{attribute.name}:</span> {attribute.value}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {preview.sourceUrl ? (
                  <a
                    className={`${baseClass}__link`}
                    href={preview.sourceUrl}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Otvoriť originál ↗
                  </a>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ScraperJobPreviews
