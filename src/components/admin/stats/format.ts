/**
 * Slovenské formátovanie čísel pre štatistické plochy v admine (Z8).
 *
 * Všetky peňažné hodnoty chodia z Payloadu v EUROCENTOCH (15500 = 155,00 €),
 * preto sa tu delí stovkou — nikde inde v týchto komponentoch sa s menou
 * nepočíta.
 *
 * Formátovače sú vytvorené raz na úrovni modulu: `Intl.NumberFormat` je drahé
 * volať v cykle a tieto komponenty ním prechádzajú tabuľkou po riadkoch.
 */

const eurFormatter = new Intl.NumberFormat('sk-SK', {
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
})

/** Kompaktná mena bez halierov — pre dlaždice a popisky grafu. */
const eurCompactFormatter = new Intl.NumberFormat('sk-SK', {
  currency: 'EUR',
  maximumFractionDigits: 0,
  style: 'currency',
})

const integerFormatter = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 })

const percentFormatter = new Intl.NumberFormat('sk-SK', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'numeric',
  year: 'numeric',
})

/** Eurocenty → „155,00 €“. */
export const formatEur = (cents: number): string => eurFormatter.format((cents || 0) / 100)

/** Eurocenty → „155 €“. */
export const formatEurCompact = (cents: number): string =>
  eurCompactFormatter.format((cents || 0) / 100)

export const formatCount = (value: number): string => integerFormatter.format(value || 0)

/** „12,5 %“ — bez znamienka. */
export const formatPercent = (value: number): string => `${percentFormatter.format(value || 0)} %`

/** „+12,5 %“ / „−12,5 %“ — pre trend. `null` = nedá sa porovnať. */
export const formatChange = (value: null | number): string => {
  if (value === null) return 'bez porovnania'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${percentFormatter.format(Math.abs(value))} %`
}

export const formatDate = (iso: string): string => {
  const date = new Date(iso)
  return isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso)
  return isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}
