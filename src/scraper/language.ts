/**
 * Rozpoznanie jazyka zdrojového e-shopu (Z12).
 *
 * Tri kroky, od najlacnejšieho:
 *
 *   1. `<html lang="pl">` — tam, kde je vyplnený, je spoľahlivý; e-shopové
 *      platformy ho generujú z nastavenia jazyka obchodu, nie z témy.
 *   2. Stopslová — krátky zoznam tvarov, ktoré sú pre daný jazyk charakteristické
 *      a v inom sa (takmer) nevyskytujú. Počíta sa výskyt na celom viditeľnom
 *      texte, takže jedna náhodná zhoda výsledok neprevráti.
 *   3. Claude — až keď prvé dve nič nedajú. Krátky prompt, jedno slovo von.
 *
 * Vracia sa dvojpísmenový ISO 639-1 kód malými písmenami (`pl`, `sk`, `cs`…),
 * alebo `null`, keď ani model nevedel. Volajúci si s `null` poradí — preklad
 * sa vtedy modelu zadá s poznámkou „jazyk neznámy".
 */
import * as cheerio from 'cheerio'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5'
const AI_TIMEOUT_MS = 8_000

/**
 * Stopslová sú zámerne vyberané tak, aby sa medzi príbuznými jazykmi
 * neprekrývali: `oraz`/`wykonany` je poľské, `veľkosť`/`ručne` slovenské,
 * `velikost`/`zboží` české. Diakritika je v kľúčoch schválne — práve ona je
 * v týchto jazykoch najsilnejším rozlišovačom.
 */
const STOPWORDS: Record<string, string[]> = {
  cs: ['zboží', 'není', 'více', 'prosím', 'dodání', 'výrobek', 'velikost', 'český', 'košík', 'cena včetně'],
  de: ['und', 'oder', 'nicht', 'größe', 'versand', 'startseite', 'warenkorb', 'produkte', 'lieferung'],
  en: ['the', 'and', 'with', 'size', 'delivery', 'add to cart', 'home page', 'products', 'shipping'],
  hu: ['és', 'nem', 'méret', 'kosár', 'termékek', 'szállítás', 'kezdőlap'],
  pl: ['oraz', 'wykonany', 'wiklina', 'przedmiot', 'dostawa', 'koszyk', 'strona główna', 'produkty', 'wysokość', 'szerokość', 'wymiary'],
  sk: ['ručne', 'veľkosť', 'doprava', 'košík', 'výrobok', 'domov', 'rozmery', 'šírka', 'výška', 'dodanie'],
  uk: ['та', 'розмір', 'кошик', 'доставка', 'товари'],
}

const ISO_MAP: Record<string, string> = {
  ces: 'cs',
  cz: 'cs',
  deu: 'de',
  eng: 'en',
  ger: 'de',
  pol: 'pl',
  slk: 'sk',
  slo: 'sk',
  ukr: 'uk',
}

/** `pl-PL`, `POL`, `pl_PL` → `pl`. Neznáme tvary vracia `null`. */
export const normalizeLangCode = (raw: null | string | undefined): null | string => {
  const value = raw?.trim().toLowerCase().replace('_', '-')

  if (!value) return null

  const head = value.split('-')[0]!

  if (head.length === 2 && /^[a-z]{2}$/.test(head)) return head

  return ISO_MAP[head] ?? null
}

/** Viditeľný text stránky, orezaný — na heuristiku stačí prvých ~20 000 znakov. */
const visibleText = (html: string): string => {
  const $ = cheerio.load(html)

  $('script, style, noscript').remove()

  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20_000).toLowerCase()
}

export const detectByStopwords = (html: string): null | string => {
  const text = visibleText(html)

  if (text.length < 200) return null

  let best: null | string = null
  let bestScore = 0

  for (const [lang, words] of Object.entries(STOPWORDS)) {
    let score = 0

    for (const word of words) {
      // Hranica slova cez medzery/interpunkciu — bez nej by „the" našlo „the"
      // v každom „theme" a angličtina by vyhrávala všade.
      const pattern = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'gu')
      const matches = text.match(pattern)

      if (matches) score += Math.min(matches.length, 5)
    }

    if (score > bestScore) {
      bestScore = score
      best = lang
    }
  }

  // Aspoň tri zhody, inak je to šum.
  return bestScore >= 3 ? best : null
}

const detectWithClaude = async (html: string): Promise<null | string> => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) return null

  const sample = visibleText(html).slice(0, 1200)

  if (sample.length < 50) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      body: JSON.stringify({
        max_tokens: 10,
        messages: [
          {
            content: `Urči jazyk tohto textu. Odpovedz VÝHRADNE dvojpísmenovým ISO 639-1 kódom, nič iné.\n\n${sample}`,
            role: 'user',
          },
        ],
        model: process.env.ANTHROPIC_SCRAPER_MODEL?.trim() || DEFAULT_MODEL,
      }),
      cache: 'no-store',
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      method: 'POST',
      signal: controller.signal,
    })

    if (!response.ok) return null

    const payload = (await response.json()) as { content?: Array<{ text?: string; type?: string }> }
    const text = (payload.content ?? [])
      .filter((block) => block?.type === 'text')
      .map((block) => block.text ?? '')
      .join('')

    return normalizeLangCode(text.match(/[a-zA-Z]{2,3}/)?.[0] ?? null)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Reťazec stratégií: `<html lang>` → stopslová → Claude. */
export const detectLanguage = async (html: string): Promise<null | string> => {
  const $ = cheerio.load(html)

  const fromAttr = normalizeLangCode(
    $('html').attr('lang') ||
      $('meta[property="og:locale"]').attr('content') ||
      $('meta[http-equiv="content-language"]').attr('content'),
  )

  if (fromAttr) return fromAttr

  const fromStopwords = detectByStopwords(html)

  if (fromStopwords) return fromStopwords

  return detectWithClaude(html)
}
