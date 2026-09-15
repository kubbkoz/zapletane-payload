/**
 * Preklad naskenovaných produktov do slovenčiny (Z12, prepísané Z14).
 *
 * Vzor volania (priamy `fetch`, žiadna SDK závislosť, obranné parsovanie JSON,
 * tvrdý timeout, pád na použiteľný výsledok) je zámerne rovnaký ako v
 * `src/seo/generate.ts` — je to zavedená konvencia projektu. Kód je tu
 * *skopírovaný*, nie importovaný: SEO generátor rieši dve krátke polia s
 * pevnými dĺžkovými limitmi, tento modul dávkový preklad celých produktov.
 * Zdieľaný „univerzálny klient" by musel slúžiť obom a ani jednému poriadne.
 *
 * **Čo sa zmenilo v Z14 a prečo.** Prvá verzia prekladala haiku po šiestich
 * produktoch naraz a časť importu „nemala hlavu ani pätu": model dostal šesť
 * kusov textu v jednom balíku, kontext sa mu medzi nimi rozmazal a poľské
 * slová z remeselníckeho slovníka (wiklina, kokarda, nosidełka) prekladal
 * doslovne, teda nesprávne. Tri veci to riešia naraz:
 *
 *   1. **Model** — predvolene `claude-sonnet-5` namiesto haiku. Za vstup
 *      platíme 2× a za výstup 2× viac ($2/$10 vs. $1/$5 za milión tokenov),
 *      čo pri ~2 500 tokenoch na produkt vychádza rádovo na jeden cent za
 *      produkt navyše. Import stoviek produktov sa robí raz; oprava stoviek
 *      nezmyselných popisov ručne stojí neporovnateľne viac.
 *   2. **Dávka 3 produkty** namiesto šiestich — model drží kontext jedného
 *      výrobku (názov + popis + kategória + parametre) pokope a nemieša ho so
 *      susedmi.
 *   3. **Slovník** priamo v systémovom prompte. Poľský nábytkársko-prútikársky
 *      slovník je dosť úzky na to, aby sa dal vymenovať, a práve na ňom
 *      všeobecný preklad padal.
 *
 * Kontrakt:
 *   - `translateBatch` NIKDY nehodí výnimku. Keď model zlyhá, vráti vstup
 *     nepreložený — import potom založí produkt s pôvodným textom a majiteľka
 *     ho opraví, čo je vždy lepšie než spadnutá dávka.
 *   - `fromLang === 'sk'` preklad úplne preskočí (žiadne volanie, žiadne
 *     náklady).
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

/** Tvrdý strop na jedno volanie. Dávka musí dobehnúť v rámci 60 s routy. */
const AI_TIMEOUT_MS = 45_000

/**
 * Koľko produktov ide do jedného volania.
 *
 * Tri je kompromis: menej kontextovej kaše než pri šiestich, a stále len dve
 * volania na štandardnú dávku piatich produktov (teda sa to do 60 s routy
 * zmestí aj s pauzami na sťahovanie stránok).
 */
export const TRANSLATION_CHUNK_SIZE = 3

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
              `Prelož do slovenčiny nasledujúce produkty (${items.length}). Každý spracuj ako jeden celok — názov, popis, kategóriu aj parametre čítaj spolu, aby preklad dával zmysel. Vráť rovnaký počet položiek s rovnakými hodnotami "index".`,
              JSON.stringify({ products: items }),
            ].join('\n\n'),
            role: 'user',
          },
        ],
        model: process.env.ANTHROPIC_SCRAPER_MODEL?.trim() || DEFAULT_MODEL,
        system: SYSTEM_PROMPT,
        // Preklad nie je úloha na uvažovanie a `claude-sonnet-5` má adaptívne
        // myslenie predvolene zapnuté — pri dávke v 60 s route by nám zjedlo
        // čas aj tokeny bez úžitku. Vypnutý stav je na tomto modeli platná
        // hodnota (na rozdiel od `budget_tokens`, ktorý už vracia 400).
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

export type CategoryTranslation = {
  /** Prečo sa nepreložilo; `null` = prešlo. Ide do logu úlohy. */
  failure: null | string
  names: string[]
}

/**
 * Preklad zoznamu názvov kategórií — JEDNO volanie na celý zoznam (Z14).
 *
 * Kategórie sú dvoj- až trojslovné pomenovania tovaru („Fotele wiklinowe"),
 * nie súvislý text; posielať ich po troch ako produkty by bolo zbytočne drahé
 * aj pomalé. Zoznam z Shoper navigácie má rádovo desiatky položiek a do jednej
 * odpovede sa zmestí bez problémov.
 *
 * Nikdy nehádže výnimku: pri akomkoľvek probléme vráti pôvodné názvy, takže
 * majiteľka uvidí v admine aspoň poľský zoznam a môže si vyberať z neho. Dôvod
 * ale vracia so sebou — nepreložený zoznam a zoznam, ktorý bol po slovensky už
 * v zdroji, vyzerajú inak úplne rovnako a bez tejto stopy by sa tichá chyba
 * (vypršaný kredit, 429 z API) nedala od seba odlíšiť.
 */
export const translateCategoryNames = async (
  names: string[],
  fromLang: null | string,
): Promise<CategoryTranslation> => {
  const clean = names.map((name) => name.trim())

  if (!clean.length || fromLang === 'sk') return { failure: null, names: clean }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    return { failure: 'Chýba ANTHROPIC_API_KEY — názvy kategórií ostávajú v pôvodnom jazyku.', names: clean }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

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
