/**
 * Preklad naskenovaných produktov do slovenčiny (Z12, prepísané Z14, opravené Z16).
 *
 * Vzor volania (priamy `fetch`, žiadna SDK závislosť, obranné parsovanie JSON,
 * tvrdý timeout) je zámerne rovnaký ako v `src/seo/generate.ts` — je to zavedená
 * konvencia projektu. Kód je tu *skopírovaný*, nie importovaný: SEO generátor
 * rieši dve krátke polia s pevnými dĺžkovými limitmi, tento modul dávkový
 * preklad celých produktov. Zdieľaný „univerzálny klient" by musel slúžiť obom
 * a ani jednému poriadne.
 *
 * **Čo sa zmenilo v Z14 a prečo.** Prvá verzia prekladala haiku po šiestich
 * produktoch naraz a časť importu „nemala hlavu ani pätu": model dostal šesť
 * kusov textu v jednom balíku, kontext sa mu medzi nimi rozmazal a poľské
 * slová z remeselníckeho slovníka (wiklina, kokarda, nosidełka) prekladal
 * doslovne, teda nesprávne. Riešia to tri veci: model `claude-sonnet-5`,
 * malá dávka a slovník priamo v systémovom prompte.
 *
 * **Čo sa zmenilo v Z16 a prečo — DÔLEŽITÉ.** Z14 nechalo v module poistku z
 * čias haiku: „keď model zlyhá, vráť vstup nepreložený". S pomalším sonnetom
 * začal 45-sekundový timeout na trojici produktov s dlhým popisom naozaj
 * vypršiavať (nameraná realita: 1 dlhý produkt ≈ 29 s, dva ≈ 42 s, tri > 45 s)
 * a tá poistka potom TICHO naimportovala poľský originál — presne to, čo
 * majiteľka videla v obchode. Preto:
 *
 *   1. **Pád na pôvodný jazyk je preč.** Zlyhaný produkt sa vráti ako
 *      `{ kind: 'failed' }` s dôvodom (timeout / HTTP / JSON / neúplná
 *      odpoveď). Volajúci ho NESMIE naimportovať — má ho skúsiť znova a po
 *      treťom neúspechu započítať medzi chyby. Jediný zostávajúci passthrough
 *      je `fromLang === 'sk'`, kde niet čo prekladať.
 *   2. **Timeout sa nehádže od oka, ale z rozpočtu dávky.** Volajúci posiela
 *      `deadlineAt` (kedy musí byť celá dávka hotová) a `reserveMs` (koľko si
 *      po preklade necháva na zápis produktu). Z toho vyjde strop na jedno
 *      volanie. Keď na volanie nezostáva rozumný čas, preklad sa ANI NEZAČNE a
 *      produkty sa vrátia ako `deferred` — to nie je chyba, len odklad na
 *      ďalší článok reťaze. Dva nezávislé časovače (jeden v module, druhý v
 *      route) by si inak konkurovali a vždy by vyhral ten horší.
 *   3. **Dávka 2 produkty.** Pri dlhých popisoch je trojica za hranicou toho,
 *      čo sa dá v jednom volaní stihnúť; dvojica sa zmestí a pri opakovaní
 *      (`chunkSize: 1`) sa zmestí aj ten najdlhší produkt.
 *
 * Kontrakt:
 *   - `translateBatch` NIKDY nehodí výnimku, ale ani nikdy nevráti nepreložený
 *     text ako preklad. Výsledok je pole `TranslationOutcome` 1:1 so vstupom.
 *   - `fromLang === 'sk'` preklad úplne preskočí (žiadne volanie, žiadne
 *     náklady).
 *   - `translateCategoryNames` si pád na pôvodné názvy PONECHÁVA: názov
 *     kategórie je kozmetika, ktorú majiteľka vidí v zozname a prepíše, a
 *     dôvod zlyhania sa aj tak vracia so sebou.
 */
import type { ScrapedAttribute, ScrapedProduct, TranslatedProduct } from './types'

import { htmlToParagraphs } from './extract'

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Predvolený model prekladu (Z14).
 *
 * `ANTHROPIC_SCRAPER_MODEL` ho stále prebije — keby sa majiteľka rozhodla, že
 * chce lacnejší beh, stačí premenná prostredia a nič sa neprekompilováva.
 */
const DEFAULT_MODEL = 'claude-sonnet-5'

/**
 * Strop na jedno prekladové volanie (Z16).
 *
 * Merané na reálnom produkte z wiklinowa-wies.pl s dlhým popisom (20 odsekov,
 * 12 parametrov): jeden produkt 28,7 s, dva 41,9 s, tri viac než 45 s. Krátke
 * produkty toho istého obchodu sú 6–11 s. 60 s je teda strop, nie očakávanie —
 * skutočný časovač vyrába `timeoutFor` z rozpočtu dávky a býva nižší.
 */
export const TRANSLATION_MAX_TIMEOUT_MS = 60_000

/**
 * Pod týmto časom sa volanie ani nezačne.
 *
 * Volanie, ktoré vypršalo, stojí peniaze aj pokus navyše a nevráti nič. Keď v
 * rozpočte dávky nezostáva aspoň toľko, je správne produkty odložiť do ďalšieho
 * článku reťaze — ten začína s plným rozpočtom.
 */
export const TRANSLATION_MIN_TIMEOUT_MS = 15_000

/**
 * Strop na preklad názvov kategórií.
 *
 * Samostatná konštanta zámerne: je to JEDNO krátke volanie (desiatky
 * dvojslovných názvov) mimo dávkového rozpočtu, spúšťa ho majiteľka tlačidlom a
 * v produkcii dobieha bez problémov.
 */
const CATEGORY_TIMEOUT_MS = 45_000

/**
 * Koľko produktov ide do jedného volania pri importe (Z16: 3 → 2).
 *
 * Dvojka je najväčšia dávka, ktorá sa aj pri najdlhšom nameranom produkte
 * zmestí do jedného volania. Pri opakovaní po zlyhaní posiela route
 * `chunkSize: 1` — vtedy má aj ten najpomalší produkt celý rozpočet pre seba.
 */
export const TRANSLATION_CHUNK_SIZE = 2

/** Koľko odsekov popisu sa posiela na preklad (zvyšok sa zahodí). */
const MAX_PARAGRAPHS = 30

/** Koľko znakov jedného odseku sa posiela (ochrana pred „stenou textu"). */
const MAX_PARAGRAPH_LENGTH = 1_200

/**
 * Slovník, ktorý sa modelu pripína do systémového promptu.
 *
 * Každý riadok je chyba, ktorú predchádzajúca verzia naozaj spravila —
 * „nosidełka" ako „nositelia" alebo „groszki" ako „puntíky" nie sú
 * hypotetické príklady. Slovník je kratší než zoznam všetkého, čo katalóg
 * obsahuje, zámerne: pripínajú sa len slová, kde je doslovný preklad
 * nebezpečne blízko a model sa doň trafí.
 */
const GLOSSARY = [
  'wiklina, wiklinowy/wiklinowa/wiklinowe → prútie, prútený/prútená/prútené (NIE „vŕbový", NIE „vikliny")',
  'kokarda → mašľa (NIE „kokarda")',
  'nosidełka → nosidlá (NIE „nositelia", NIE „nosiče")',
  'groszki, w groszki → bodky, s bodkami (NIE „puntíky", NIE „hrášky")',
  'skrzynia, truhla → truhlica',
  'wózek → kočík',
  'kołyska → kolíska',
  'bujany, bujak → hojdací, hojdačka',
  'fotel → kreslo; pufa → taburetka; kosz → kôš; komplet → súprava',
  'rattan → ratan; plecionka → výplet; ucho/uchwyt → ucho/držadlo',
]

const SYSTEM_PROMPT = [
  'Si slovenský redaktor a prekladateľ produktových textov pre e-shop s ručne pletenými a prútenými výrobkami pre domov a deti.',
  'Prekladáš VŽDY CELÝ JEDEN PRODUKT NARAZ: názov, popis, kategóriu aj parametre posudzuj spoločne, ako jeden text o jednej veci.',
  '',
  'Hlavné pravidlo:',
  'Preklad musí dávať zmysel v kontexte e-shopu s ručne pletenými/prútenými výrobkami. Ak je zdrojový text nesúrodý alebo zle štruktúrovaný, prepíš ho do zrozumiteľnej, prirodzenej slovenčiny — vecne verný, ale čitateľný. Nikdy neprekladaj doslovne na úkor zmyslu.',
  '',
  'Ďalšie pravidlá:',
  '- NÁZOV produktu vracaj v prirodzenej slovenskej vetnej podobe — prvé slovo s veľkým písmenom, zvyšok malými. NIKDY nie celý názov veľkými písmenami, aj keď taký prišiel na vstupe.',
  '- Názvy modelov a kolekcií v úvodzovkách („Regan", „Little Cottage") ostávajú s veľkým začiatočným písmenom a neprekladajú sa.',
  '- ČÍSLA, ROZMERY, JEDNOTKY A KÓDY prepisuj DOSLOVNE a bez prepočtu (81 cm ostáva 81 cm).',
  '- Zachovaj členenie na odseky: koľko odsekov príde, toľko odsekov vráť, v rovnakom poradí.',
  '- Neskracuj a nepridávaj marketingové frázy, ktoré v origináli nie sú. Žiadne emoji, žiadne výkričníky navyše.',
  '- Názvy kategórií prekladaj ako bežné slovenské pomenovania tovaru („Fotele wiklinowe" → „Prútené kreslá").',
  '- Názvy aj hodnoty vlastností prekladaj rovnako vecne („Kolor: biały" → „Farba: biela").',
  '- Ak je časť textu už po slovensky, nechaj ju tak.',
  // Bez tohto pravidla model k slovenskej dolnej úvodzovke („) dopisuje
  // obyčajnú hornú ("), ktorú v JSON reťazci nezaescapuje a rozbije tým celú
  // odpoveď. `repairJsonQuotes` to síce opraví, ale lepšie je nezaviniť to.
  '- V texte NIKDY nepoužívaj obyčajnú dvojitú úvodzovku ("). Namiesto nej píš slovenské typografické úvodzovky „ a “.',
  '',
  'Záväzný slovník (poľština → slovenčina):',
  ...GLOSSARY.map((entry) => `- ${entry}`),
  '',
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

/**
 * Neupravený vstup ako výstup.
 *
 * Od Z16 sa používa VÝHRADNE pri `fromLang === 'sk'`, teda keď je zdroj už po
 * slovensky a prekladať niet čo. Pri zlyhaní modelu sa nepoužíva — presne tá
 * cesta importovala poľské produkty.
 */
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
 * Bez opravy padne celá dávka a produkty sa zbytočne prekladajú druhýkrát.
 * Preto sa reťazec prejde znak po znaku a každá úvodzovka vnútri reťazca sa
 * posúdi: skutočná koncová je len tá, za ktorou (po bielych znakoch) nasleduje
 * `:` `}` `]`, alebo `,` a po nej začiatok ďalšej hodnoty. Čokoľvek iné je
 * úvodzovka v texte a doplní sa jej spätné lomítko.
 *
 * Zámerne sa nič iné neopravuje (chýbajúce čiarky, komentáre…): tam už je
 * riziko, že sa „oprava" trafí vedľa, väčšie než úžitok — vtedy je správne
 * ohlásiť zlyhanie a produkt skúsiť znova.
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
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
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

/**
 * Prečo sa produkt nepreložil. Ide do logu úlohy, aby sa timeout (pomalý model,
 * dlhý popis) dal odlíšiť od 429 (vyčerpaný kredit) a od rozbitého JSON-u.
 */
export type TranslationFailureCause =
  /** Chýba `ANTHROPIC_API_KEY` — preklad sa vôbec nedá spustiť. */
  | 'config'
  /** API odpovedalo chybovým stavom (429, 5xx…). */
  | 'http'
  /** Odpoveď sa nedala prečítať ako JSON, alebo v nej produkt chýbal. */
  | 'json'
  /** Odpoveď prišla, ale bez názvu alebo bez popisu — nedá sa z nej importovať. */
  | 'incomplete'
  /** Sieťová chyba pri volaní API. */
  | 'network'
  /** Volanie nestihlo dobehnúť v pridelenom čase. */
  | 'timeout'

/**
 * Výsledok prekladu JEDNÉHO produktu.
 *
 * Tri stavy, nie dva: `deferred` (na produkt v tomto volaní routy nezvýšil čas)
 * je zásadne iné než `failed` (model zlyhal). Odložený produkt ostáva vo fronte
 * a nič sa nepočíta; zlyhaný sa počíta ako pokus a po treťom sa vzdáva.
 */
export type TranslationOutcome =
  | { cause: TranslationFailureCause; kind: 'failed'; reason: string }
  | { kind: 'deferred'; reason: string }
  | { kind: 'ok'; product: TranslatedProduct }

export type TranslationUsage = {
  calls: number
  inputTokens: number
  outputTokens: number
}

export type TranslateOptions = {
  /** Koľko produktov ide do jedného volania (predvolene `TRANSLATION_CHUNK_SIZE`). */
  chunkSize?: number
  /** Kedy musí byť celá práca routy hotová (epoch ms). `null` = bez rozpočtu. */
  deadlineAt?: null | number
  /** Koľko času si volajúci necháva po preklade na zápis produktu. */
  reserveMs?: number
}

export type TranslateBatchResult = {
  /** 1:1 so vstupom a v rovnakom poradí. */
  outcomes: TranslationOutcome[]
  usage: TranslationUsage
}

/**
 * Koľko času smie dostať jedno volanie modelu.
 *
 * `0` znamená „nezačínaj" — v rozpočte nezostáva ani `TRANSLATION_MIN_TIMEOUT_MS`,
 * takže volanie by s veľkou pravdepodobnosťou vypršalo a minulo pokus aj kredit
 * zadarmo.
 */
export const timeoutFor = (deadlineAt: null | number | undefined, reserveMs = 0): number => {
  if (!deadlineAt) return TRANSLATION_MAX_TIMEOUT_MS

  const available = deadlineAt - Date.now() - reserveMs

  if (available < TRANSLATION_MIN_TIMEOUT_MS) return 0

  return Math.min(TRANSLATION_MAX_TIMEOUT_MS, available)
}

const failAll = (
  items: TranslationItem[],
  cause: TranslationFailureCause,
  reason: string,
): TranslationOutcome[] => items.map(() => ({ cause, kind: 'failed', reason }))

/** Jedna dávka (≤ `chunkSize` produktov) v jednom volaní. */
const translateChunk = async (
  items: TranslationItem[],
  fromLang: null | string,
  usage: TranslationUsage,
  timeoutMs: number,
): Promise<TranslationOutcome[]> => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    return failAll(items, 'config', 'Chýba ANTHROPIC_API_KEY — preklad sa nedá spustiť.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

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
              `Prelož do slovenčiny nasledujúce produkty (${items.length}). Každý spracuj ako jeden celok — názov, popis, kategóriu aj parametre čítaj spolu, aby preklad dával zmysel. Vráť rovnaký počet položiek s rovnakými hodnotami "index".`,
              JSON.stringify({ products: items }),
            ].join('\n\n'),
            role: 'user',
          },
        ],
        model: process.env.ANTHROPIC_SCRAPER_MODEL?.trim() || DEFAULT_MODEL,
        system: SYSTEM_PROMPT,
        // Preklad nie je úloha na uvažovanie a `claude-sonnet-5` má adaptívne
        // myslenie predvolene zapnuté — pri dávke v rozpočte routy by nám
        // zjedlo čas aj tokeny bez úžitku. Vypnutý stav je na tomto modeli
        // platná hodnota (na rozdiel od `budget_tokens`, ktorý už vracia 400).
        thinking: { type: 'disabled' },
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
      return failAll(items, 'http', `Preklad: API odpovedalo ${response.status}.`)
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
      return failAll(
        items,
        'json',
        `Preklad: z odpovede sa nedali prečítať produkty (stop_reason=${
          payload.stop_reason ?? '?'
        }, ${raw.length} znakov): ${raw.slice(0, 200).replace(/\s+/g, ' ')}`,
      )
    }

    return items.map((item): TranslationOutcome => {
      const match = translatedList.find(
        (entry) => Number((entry as { index?: unknown })?.index) === item.index,
      ) as Record<string, unknown> | undefined

      if (!match) {
        return {
          cause: 'json',
          kind: 'failed',
          reason: `Preklad: v odpovedi chýba produkt s indexom ${item.index} („${item.title}").`,
        }
      }

      const title = typeof match.title === 'string' ? match.title.trim() : ''
      const paragraphs = asStringArray(match.paragraphs)

      // Názov je jediné povinné pole produktu — bez neho niet čo zakladať.
      // Popis je povinný len vtedy, keď ho zdroj mal: prázdny popis v zdroji
      // znamená prázdny popis v cieli, nie zlyhanie.
      if (!title) {
        return {
          cause: 'incomplete',
          kind: 'failed',
          reason: `Preklad: k produktu „${item.title}" sa vrátil prázdny názov.`,
        }
      }

      if (item.paragraphs.length && !paragraphs.length) {
        return {
          cause: 'incomplete',
          kind: 'failed',
          reason: `Preklad: k produktu „${item.title}" sa vrátil prázdny popis (zdroj mal ${item.paragraphs.length} odsekov).`,
        }
      }

      return {
        kind: 'ok',
        product: {
          // Kategórie ani parametre sa NIKDY nedopĺňajú z originálu: poľský
          // názov kategórie by v obchode založil poľskú kategóriu a poľský
          // názov vlastnosti poľskú vlastnosť. Radšej prázdne než cudzie.
          attributes: asAttributes(match.attributes),
          categoryPath: asStringArray(match.categoryPath),
          descriptionParagraphs: paragraphs,
          title,
        },
      }
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const elapsed = Date.now() - startedAt

    if (name === 'AbortError' || name === 'TimeoutError') {
      return failAll(
        items,
        'timeout',
        `Preklad nestihol dobehnúť do ${Math.round(timeoutMs / 1_000)} s (trval ${Math.round(
          elapsed / 1_000,
        )} s, ${items.length} ${items.length === 1 ? 'produkt' : 'produkty'}).`,
      )
    }

    return failAll(
      items,
      'network',
      `Preklad zlyhal: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Preloží zoznam naskenovaných produktov do slovenčiny.
 *
 * Poradie výstupu zodpovedá poradiu vstupu 1:1 — volajúci môže spárovať
 * `products[i]` s `outcomes[i]` bez ďalšieho hľadania.
 */
export const translateBatch = async (
  products: ScrapedProduct[],
  fromLang: null | string,
  options: TranslateOptions = {},
): Promise<TranslateBatchResult> => {
  const usage: TranslationUsage = { calls: 0, inputTokens: 0, outputTokens: 0 }
  const items = products.map(toTranslationItem)

  if (!items.length) return { outcomes: [], usage }

  // Zdroj je už po slovensky — netreba volať model.
  if (fromLang === 'sk') {
    return { outcomes: items.map((item) => ({ kind: 'ok', product: passthrough(item) })), usage }
  }

  const chunkSize = Math.max(1, options.chunkSize ?? TRANSLATION_CHUNK_SIZE)
  const reserveMs = options.reserveMs ?? 0
  const outcomes: TranslationOutcome[] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const timeoutMs = timeoutFor(options.deadlineAt, reserveMs)

    if (!timeoutMs) {
      // Na ďalšie volanie už v rozpočte nie je čas. Zvyšok sa neoznačí za
      // chybu — ostáva vo fronte a spracuje ho ďalší článok reťaze.
      for (let rest = i; rest < items.length; rest++) {
        outcomes.push({
          kind: 'deferred',
          reason: 'Na preklad v tomto kroku nezostal čas — pokračuje sa v ďalšom.',
        })
      }

      break
    }

    outcomes.push(...(await translateChunk(chunk, fromLang, usage, timeoutMs)))
  }

  return { outcomes, usage }
}

export type CategoryTranslation = {
  /** Prečo sa nepreložilo; `null` = prešlo. Ide do logu úlohy. */
  failure: null | string
  names: string[]
}

/**
 * Preklad zoznamu názvov kategórií — JEDNO volanie na celý zoznam (Z14).
 *
 * Kategórie sú dvoj- až trojslovné pomenovania tovaru („Fotele wiklinowe"),
 * nie súvislý text; posielať ich po dvoch ako produkty by bolo zbytočne drahé
 * aj pomalé. Zoznam z Shoper navigácie má rádovo desiatky položiek a do jednej
 * odpovede sa zmestí bez problémov.
 *
 * **Pád na pôvodné názvy tu ostáva aj po Z16** — a je to zámer, nie prehliadnutie.
 * Nepreložený názov kategórie sa nikam neimportuje: majiteľka ho vidí v zozname
 * na výber, prečíta si v logu dôvod a môže to skúsiť znova. Poľský názov
 * PRODUKTU je oproti tomu zápis do obchodu, ktorý treba ručne opravovať — preto
 * je tam pád zakázaný.
 */
export const translateCategoryNames = async (
  names: string[],
  fromLang: null | string,
): Promise<CategoryTranslation> => {
  const clean = names.map((name) => name.trim())

  if (!clean.length || fromLang === 'sk') return { failure: null, names: clean }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    return {
      failure: 'Chýba ANTHROPIC_API_KEY — názvy kategórií ostávajú v pôvodnom jazyku.',
      names: clean,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CATEGORY_TIMEOUT_MS)

  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      body: JSON.stringify({
        max_tokens: 4_000,
        messages: [
          {
            content: [
              fromLang ? `Zdrojový jazyk: ${fromLang}.` : 'Zdrojový jazyk urči sám z textu.',
              'Prelož názvy kategórií e-shopu do slovenčiny. Sú to bežné pomenovania tovaru, nie vety — prekladaj ich ako názvy kategórií v e-shope („Fotele wiklinowe" → „Prútené kreslá"). Prvé slovo s veľkým písmenom, zvyšok malými.',
              'Vráť rovnaký počet položiek v rovnakom poradí.',
              JSON.stringify({ names: clean }),
              'Odpovedz VÝHRADNE JSON objektom {"names":["...","..."]}.',
            ].join('\n\n'),
            role: 'user',
          },
        ],
        model: process.env.ANTHROPIC_SCRAPER_MODEL?.trim() || DEFAULT_MODEL,
        system: SYSTEM_PROMPT,
        thinking: { type: 'disabled' },
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
      return { failure: `Preklad kategórií: API odpovedalo ${response.status}.`, names: clean }
    }

    const payload = (await response.json()) as { stop_reason?: string }
    const raw = responseText(payload)
    const parsed = extractJson(raw)
    const translated = asStringArray(parsed?.names)

    // Keď sa počet nezhoduje, nedá sa spoľahlivo spárovať, ktorý názov patrí
    // ku ktorej adrese — radšej celý zoznam nepreložený než pomiešaný.
    if (translated.length !== clean.length) {
      return {
        failure: `Preklad kategórií: odpoveď sa nedala prečítať (stop_reason=${
          payload.stop_reason ?? '?'
        }, ${translated.length} z ${clean.length} názvov): ${raw.slice(0, 200).replace(/\s+/g, ' ')}`,
        names: clean,
      }
    }

    return { failure: null, names: translated }
  } catch (error) {
    return {
      failure: `Preklad kategórií zlyhal: ${error instanceof Error ? error.message : String(error)}`,
      names: clean,
    }
  } finally {
    clearTimeout(timer)
  }
}
