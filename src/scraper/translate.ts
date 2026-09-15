/**
 * Preklad naskenovaných produktov do slovenčiny (Z12).
 *
 * Vzor volania (priamy `fetch`, žiadna SDK závislosť, obranné parsovanie JSON,
 * tvrdý timeout, pád na použiteľný výsledok) je zámerne rovnaký ako v
 * `src/seo/generate.ts` — je to zavedená konvencia projektu. Kód je tu
 * *skopírovaný*, nie importovaný: SEO generátor rieši dve krátke polia s
 * pevnými dĺžkovými limitmi, tento modul dávkový preklad celých produktov.
 * Zdieľaný „univerzálny klient" by musel slúžiť obom a ani jednému poriadne.
 *
 * Kontrakt:
 *   - `translateBatch` NIKDY nehodí výnimku. Keď model zlyhá, vráti vstup
 *     nepreložený — import potom založí produkt s pôvodným textom a majiteľka
 *     ho opraví, čo je vždy lepšie než spadnutá dávka.
 *   - `fromLang === 'sk'` preklad úplne preskočí (žiadne volanie, žiadne
 *     náklady).
 *   - Dávka je ~6 produktov na jedno volanie: väčšia dávka znamená dlhšiu
 *     odpoveď, väčšiu šancu na orezanie pri `max_tokens` a drahší opakovaný
 *     pokus pri chybe.
 */
import type { ScrapedAttribute, ScrapedProduct, TranslatedProduct } from './types'

import { htmlToParagraphs } from './extract'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5'

/** Tvrdý strop na jedno volanie. Dávka musí dobehnúť v rámci 60 s routy. */
const AI_TIMEOUT_MS = 45_000

/** Koľko produktov ide do jedného volania. */
export const TRANSLATION_CHUNK_SIZE = 6

/** Koľko odsekov popisu sa posiela na preklad (zvyšok sa zahodí). */
const MAX_PARAGRAPHS = 30

/** Koľko znakov jedného odseku sa posiela (ochrana pred „stenou textu"). */
const MAX_PARAGRAPH_LENGTH = 1_200

const SYSTEM_PROMPT = [
  'Si prekladateľ produktových textov pre slovenský e-shop s ručne vyrábaným tovarom pre domov.',
  'Prekladáš do prirodzenej spisovnej slovenčiny.',
  'Pravidlá:',
  '- Preklad musí znieť ako text napísaný po slovensky, nie ako doslovný prepis.',
  '- ČÍSLA, ROZMERY, JEDNOTKY A KÓDY prepisuj DOSLOVNE a bez prepočtu (81 cm ostáva 81 cm).',
  '- Zachovaj členenie na odseky: koľko odsekov príde, toľko odsekov vráť, v rovnakom poradí.',
  '- Neskracuj a nepridávaj marketingové frázy, ktoré v origináli nie sú. Žiadne emoji, žiadne výkričníky navyše.',
  '- Názvy kategórií prekladaj ako bežné slovenské pomenovania tovaru (napr. „Fotele wiklinowe" → „Prútené kreslá").',
  '- Názvy aj hodnoty vlastností prekladaj rovnako vecne („Kolor: biały" → „Farba: biela").',
  '- Ak je časť textu už po slovensky, nechaj ju tak.',
  // Bez tohto pravidla model k slovenskej dolnej úvodzovke („) dopisuje
  // obyčajnú hornú ("), ktorú v JSON reťazci nezaescapuje a rozbije tým celú
  // odpoveď. `repairJsonQuotes` to síce opraví, ale lepšie je nezaviniť to.
  '- V texte NIKDY nepoužívaj obyčajnú dvojitú úvodzovku ("). Namiesto nej píš slovenské typografické úvodzovky „ a “.',
  'Odpovedaj VÝHRADNE jedným JSON objektom bez akéhokoľvek ďalšieho textu, v tvare:',
  '{"products":[{"index":0,"title":"...","paragraphs":["...","..."],"categoryPath":["..."],"attributes":[{"name":"...","value":"..."}]}]}',
].join('\n')

type TranslationItem = {
  attributes: ScrapedAttribute[]
  categoryPath: string[]
  index: number
  paragraphs: string[]
  title: string
}

/** Zo `ScrapedProduct` spraví to, čo ide modelu — bez cien, obrázkov a URL. */
const toTranslationItem = (product: ScrapedProduct, index: number): TranslationItem => ({
  attributes: product.attributes.slice(0, 20),
  categoryPath: product.categoryPath,
  index,
  paragraphs: htmlToParagraphs(product.descriptionHtml)
    .slice(0, MAX_PARAGRAPHS)
    .map((paragraph) => paragraph.slice(0, MAX_PARAGRAPH_LENGTH)),
  title: product.title,
})

/** Neupravený vstup ako výstup — používa sa pri `sk` aj pri zlyhaní modelu. */
const passthrough = (item: TranslationItem): TranslatedProduct => ({
  attributes: item.attributes,
  categoryPath: item.categoryPath,
  descriptionParagraphs: item.paragraphs,
  title: item.title,
})

/**
 * Znaky, ktorými smie v platnom JSON-e začínať hodnota alebo kľúč hneď za
 * čiarkou. Slúžia ako dôkaz, že úvodzovka pred čiarkou bola naozaj koncová.
 */
const JSON_VALUE_START = /["{[\-\dtfn]/

/**
 * Oprava nezaescapovaných úvodzoviek vnútri reťazcov.
 *
 * Toto nie je teoretická poistka — je to najčastejší spôsob, akým sa rozbije
 * preklad práve tohto obsahu. Slovenčina aj poľština používajú dolnú otváraciu
 * úvodzovku („) a model k nej rád dopíše OBYČAJNÚ hornú ("), ktorú do JSON
 * reťazca nezaescapuje:
 *
 *     "Predstavujeme kolekciu „Little Cottage", ktorú tvoria:"
 *                                            ↑ tu sa JSON.parse zlomí
 *
 * Bez opravy padne celá dávka na pôvodný jazyk a majiteľka dostane poľské
 * produkty. Preto sa reťazec prejde znak po znaku a každá úvodzovka vnútri
 * reťazca sa posúdi: skutočná koncová je len tá, za ktorou (po bielych
 * znakoch) nasleduje `:` `}` `]`, alebo `,` a po nej začiatok ďalšej hodnoty.
 * Čokoľvek iné je úvodzovka v texte a doplní sa jej spätné lomítko.
 *
 * Zámerne sa nič iné neopravuje (chýbajúce čiarky, komentáre…): tam už je
 * riziko, že sa „oprava" trafí vedľa, väčšie než úžitok — vtedy je správne
 * nechať text nepreložený a napísať to do logu.
 */
export const repairJsonQuotes = (input: string): string => {
  let out = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!

    if (!inString) {
      out += char
      if (char === '"') inString = true
      continue
    }

    if (escaped) {
      out += char
      escaped = false
      continue
    }

    if (char === '\\') {
      out += char
      escaped = true
      continue
    }

    if (char !== '"') {
      out += char
      continue
    }

    // Kandidát na koniec reťazca — pozrime sa, čo nasleduje.
    let j = i + 1

    while (j < input.length && /\s/.test(input[j]!)) j++

    const next = input[j]

    const closes =
      next === ':' ||
      next === '}' ||
      next === ']' ||
      (next === ',' &&
        (() => {
          let k = j + 1

          while (k < input.length && /\s/.test(input[k]!)) k++

          return k >= input.length || JSON_VALUE_START.test(input[k]!)
        })())

    if (closes) {
      out += char
      inString = false
    } else {
      out += '\\"'
    }
  }

  return out
}

/** Z odpovede modelu vytiahne JSON objekt (aj z ```json bloku alebo vety okolo). */
const extractJson = (text: string): null | Record<string, unknown> => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end <= start) return null

  const body = candidate.slice(start, end + 1)

  for (const attempt of [body, repairJsonQuotes(body)]) {
    try {
      const parsed: unknown = JSON.parse(attempt)

      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // Skúsi sa opravená verzia; keď ani tá neprejde, vráti sa `null`.
    }
  }

  return null
}

/** Z odpovede Messages API poskladá text (content[] je pole blokov). */
const responseText = (payload: unknown): string => {
  const content = (payload as { content?: unknown })?.content

  if (!Array.isArray(content)) return ''

  return content
    .map((block) =>
      block && typeof block === 'object' && (block as { type?: string }).type === 'text'
        ? String((block as { text?: unknown }).text ?? '')
        : '',
    )
    .join('')
    .trim()
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : []

const asAttributes = (value: unknown): ScrapedAttribute[] =>
  Array.isArray(value)
    ? value
        .map((entry) => ({
          name: String((entry as { name?: unknown })?.name ?? '').trim(),
          value: String((entry as { value?: unknown })?.value ?? '').trim(),
        }))
        .filter((entry) => entry.name && entry.value)
    : []

export type TranslationUsage = {
  calls: number
  /**
   * Prečo niektorá dávka ostala nepreložená. Prázdne pole = všetko prešlo.
   *
   * Preklad zámerne nikdy nehodí výnimku (import nesmie spadnúť kvôli
   * prekladu), takže bez tejto stopy by zlyhanie vyzeralo v admine úplne
   * rovnako ako zdroj, ktorý je náhodou po slovensky — a nikto by sa to
   * nedozvedel. Route ju vypisuje do logu úlohy.
   */
  failures: string[]
  inputTokens: number
  outputTokens: number
}

/** Jedna dávka (≤ `TRANSLATION_CHUNK_SIZE` produktov) v jednom volaní. */
const translateChunk = async (
  items: TranslationItem[],
  fromLang: null | string,
  usage: TranslationUsage,
): Promise<TranslatedProduct[]> => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    usage.failures.push('Chýba ANTHROPIC_API_KEY — texty ostávajú v pôvodnom jazyku.')

    return items.map(passthrough)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      body: JSON.stringify({
        max_tokens: 8_000,
        messages: [
          {
            content: [
              fromLang
                ? `Zdrojový jazyk: ${fromLang}.`
                : 'Zdrojový jazyk sa nepodarilo určiť — urči ho sám z textu.',
              'Prelož do slovenčiny nasledujúce produkty. Vráť rovnaký počet položiek s rovnakými hodnotami "index".',
              JSON.stringify({ products: items }),
            ].join('\n\n'),
            role: 'user',
          },
        ],
        model: process.env.ANTHROPIC_SCRAPER_MODEL?.trim() || DEFAULT_MODEL,
        system: SYSTEM_PROMPT,
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

    if (!response.ok) {
      usage.failures.push(`Preklad: API odpovedalo ${response.status}.`)

      return items.map(passthrough)
    }

    const payload = (await response.json()) as {
      stop_reason?: string
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    usage.calls++
    usage.inputTokens += payload.usage?.input_tokens ?? 0
    usage.outputTokens += payload.usage?.output_tokens ?? 0

    const raw = responseText(payload)
    const parsed = extractJson(raw)
    const translatedList = Array.isArray(parsed?.products) ? parsed.products : []

    if (!translatedList.length) {
      // `max_tokens` je najčastejšia príčina: odpoveď sa odsekne uprostred
      // JSON-u a parser z nej nevytiahne nič. Preto je v hláške aj dôvod
      // zastavenia a začiatok odpovede — z toho sa dá rozhodnúť, či stačí
      // zmenšiť dávku, alebo je zlý prompt.
      usage.failures.push(
        `Preklad: z odpovede sa nedali prečítať produkty (stop_reason=${
          payload.stop_reason ?? '?'
        }, ${raw.length} znakov): ${raw.slice(0, 200).replace(/\s+/g, ' ')}`,
      )
    }

    return items.map((item) => {
      const match = translatedList.find(
        (entry) => Number((entry as { index?: unknown })?.index) === item.index,
      ) as Record<string, unknown> | undefined

      if (!match) return passthrough(item)

      const title = typeof match.title === 'string' ? match.title.trim() : ''
      const paragraphs = asStringArray(match.paragraphs)
      const categoryPath = asStringArray(match.categoryPath)
      const attributes = asAttributes(match.attributes)

      return {
        // Každé pole padá na originál samostatne: keď model vynechá kategórie,
        // nie je dôvod zahodiť aj preložený názov a popis.
        attributes: attributes.length === item.attributes.length ? attributes : item.attributes,
        categoryPath: categoryPath.length ? categoryPath : item.categoryPath,
        descriptionParagraphs: paragraphs.length ? paragraphs : item.paragraphs,
        title: title || item.title,
      }
    })
  } catch (error) {
    usage.failures.push(
      `Preklad zlyhal: ${error instanceof Error ? error.message : String(error)}`,
    )

    return items.map(passthrough)
  } finally {
    clearTimeout(timer)
  }
}

export type TranslateBatchResult = {
  items: TranslatedProduct[]
  usage: TranslationUsage
}

/**
 * Preloží zoznam naskenovaných produktov do slovenčiny.
 *
 * Poradie výstupu zodpovedá poradiu vstupu 1:1 — volajúci môže spárovať
 * `scraped[i]` s `translated[i]` bez ďalšieho hľadania.
 */
export const translateBatch = async (
  products: ScrapedProduct[],
  fromLang: null | string,
): Promise<TranslateBatchResult> => {
  const usage: TranslationUsage = { calls: 0, failures: [], inputTokens: 0, outputTokens: 0 }
  const items = products.map(toTranslationItem)

  if (!items.length) return { items: [], usage }

  // Zdroj je už po slovensky — netreba volať model.
  if (fromLang === 'sk') return { items: items.map(passthrough), usage }

  const out: TranslatedProduct[] = []

  for (let i = 0; i < items.length; i += TRANSLATION_CHUNK_SIZE) {
    const chunk = items.slice(i, i + TRANSLATION_CHUNK_SIZE)

    out.push(...(await translateChunk(chunk, fromLang, usage)))
  }

  return { items: out, usage }
}
