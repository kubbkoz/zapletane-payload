/**
 * Prepočet ceny na eurá a zaokrúhlenie na X,99 (Z12).
 *
 * Dve oddelené veci, zámerne v jednom súbore, lebo sa nikdy nepoužívajú
 * samostatne:
 *
 *   1. **Kurz.** V produkcii sa berie živý denný kurz z Frankfurter API
 *      (`api.frankfurter.dev`, dáta ECB, bez kľúča a bez limitu). Odpoveď sa
 *      drží v pamäti procesu 6 hodín — ECB kurz sa aj tak mení raz denne a
 *      import 300 produktov nemá zmysel pýtať 300×.
 *      **V tomto vývojovom sandboxe doména whitelistovaná NIE JE**, takže
 *      volanie spadne na timeout a použije sa `fallbackRate` z úlohy. Živá
 *      vetva je teda overená len logikou, nie reálnym volaním — v produkcii
 *      (Vercel, bez proxy) beží normálne.
 *   2. **Zaokrúhlenie nahor na X,99.** Psychologická cena, ktorú si majiteľka
 *      žiada: nikdy nadol (nesmieme predávať pod prepočítanú cenu), vždy na
 *      najbližšie deväťdesiatdeväť centov.
 *        28,10 € → 28,99 €   28,99 € → 28,99 €   29,00 € → 29,99 €
 */

const FRANKFURTER_ENDPOINT = 'https://api.frankfurter.dev/v1/latest'
const RATE_TIMEOUT_MS = 5_000
const RATE_TTL_MS = 6 * 60 * 60 * 1_000

/** Predvolený kurz, keď úloha nemá vlastný a živý kurz nie je dostupný. */
export const DEFAULT_FALLBACK_RATE = 4.3

type CachedRate = { fetchedAt: number; rate: number }

const rateCache = new Map<string, CachedRate>()

export type ConversionSource = 'eur' | 'fallback' | 'live'

export type PriceConversion = {
  /** Zaokrúhlená cena v eurocentoch — presne to, čo ide do `priceInEUR`. */
  eurocents: number
  /** Kurz použitý pri prepočte (koľko jednotiek meny za 1 €). */
  rate: number
  /** Cena pred zaokrúhlením, v eurách. */
  rawEur: number
  source: ConversionSource
}

/**
 * Zaokrúhlenie nahor na najbližšie „celé číslo + 0,99".
 *
 * Práca sa robí v centoch, nie v `float` eurách: `28.99 * 100` je v
 * dvojitej presnosti `2898.9999…`, takže `Math.floor` by z korektnej ceny
 * spravil 28,98 €.
 */
export const roundUpTo99 = (eur: number): number => {
  if (!Number.isFinite(eur) || eur <= 0) return 0

  const cents = Math.round(eur * 100)
  const whole = Math.floor(cents / 100)

  return cents <= whole * 100 + 99 ? whole * 100 + 99 : (whole + 1) * 100 + 99
}

/**
 * Živý kurz `1 <mena> = X €`. Vracia `null` pri akomkoľvek probléme —
 * volajúci potom použije `fallbackRate` z úlohy.
 */
export const fetchLiveRate = async (currency: string): Promise<null | number> => {
  const code = currency.toUpperCase()
  const cached = rateCache.get(code)

  if (cached && Date.now() - cached.fetchedAt < RATE_TTL_MS) return cached.rate

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RATE_TIMEOUT_MS)

  try {
    const response = await fetch(`${FRANKFURTER_ENDPOINT}?base=${code}&symbols=EUR`, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) return null

    const payload = (await response.json()) as { rates?: Record<string, unknown> }
    const perUnit = payload.rates?.EUR

    if (typeof perUnit !== 'number' || !Number.isFinite(perUnit) || perUnit <= 0) return null

    // Frankfurter vracia „koľko € za 1 PLN"; my držíme opačný kurz („koľko PLN
    // za 1 €"), lebo v tom tvare ho majiteľka zadáva do `fallbackRate`.
    const rate = 1 / perUnit

    rateCache.set(code, { fetchedAt: Date.now(), rate })

    return rate
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export type ConvertPriceOptions = {
  /** Kurz z úlohy (koľko jednotiek cudzej meny za 1 €). */
  fallbackRate?: null | number
  /** Vypne živé volanie — používa sa v testoch a pri hromadnom importe. */
  skipLiveRate?: boolean
}

/**
 * Prepočet jednej ceny. EUR prechádza bez kurzu (len sa zaokrúhli), ostatné
 * meny cez živý kurz s pádom na `fallbackRate`.
 */
export const convertPrice = async (
  amount: null | number,
  currency: null | string,
  options: ConvertPriceOptions = {},
): Promise<null | PriceConversion> => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null

  const code = (currency || 'EUR').toUpperCase()

  if (code === 'EUR') {
    return { eurocents: roundUpTo99(amount), rate: 1, rawEur: amount, source: 'eur' }
  }

  const live = options.skipLiveRate ? null : await fetchLiveRate(code)
  const fallback =
    typeof options.fallbackRate === 'number' && options.fallbackRate > 0
      ? options.fallbackRate
      : DEFAULT_FALLBACK_RATE
  const rate = live ?? fallback
  const rawEur = amount / rate

  return {
    eurocents: roundUpTo99(rawEur),
    rate,
    rawEur,
    source: live ? 'live' : 'fallback',
  }
}

/** Eurocenty → „28,99 €" (slovenský desatinný oddeľovač). */
export const formatEurocents = (value: null | number): null | string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${(value / 100).toFixed(2).replace('.', ',')} €`
    : null
