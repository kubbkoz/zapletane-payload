/**
 * Generovanie blogových článkov (Z15).
 *
 * Jeden motor, žiadna záchranná šablóna: majiteľka zadá tému, model napíše
 * článok. Keď sa to nepodarí — chýbajúci kľúč, sieť, nečitateľná odpoveď,
 * podozrivo krátky text — vráti sa **chyba**, nie náhradný článok. Slabý
 * článok je horší než hláška „skús to znova": hláška stojí jedno kliknutie,
 * zlý text sa dostane na web pod menom majiteľky.
 *
 * Obranná výbava je odpísaná z `src/seo/generate.ts` (tvrdý časovač, `fetch`
 * bez SDK, tolerantné čítanie JSON-u z odpovede) a odtiaľ sa aj importujú
 * spoločné SEO limity — meta údaje článku musia sedieť rovnako ako pri
 * produktoch.
 *
 * Model: `claude-sonnet-5`, prepísateľné cez `ANTHROPIC_ARTICLE_MODEL`.
 *
 * Pozor na `temperature`: rodina Sonnet 5 / Opus 4.6+ ju už neprijíma
 * (`400 — temperature is deprecated for this model`), takže sa posiela len
 * modelom, ktoré ju ešte podporujú, a keď ju API aj tak odmietne, volanie sa
 * raz zopakuje bez nej. Viac v `SAMPLING_FREE_MODEL` nižšie.
 */

import { buildMetaTitle, MAX_DESCRIPTION, MIN_DESCRIPTION } from '@/seo/generate'

const BRAND = (process.env.SITE_NAME || 'ZAPLETANE').trim() || 'ZAPLETANE'

const DEFAULT_MODEL = 'claude-sonnet-5'
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Strop na dĺžku odpovede. Článok 600–900 slov + meta sa zmestí s rezervou. */
const MAX_TOKENS = 6000

/** Nepovinná kreativita pre staršie modely; novšie ju odmietajú (viď hlavičku). */
const TEMPERATURE = 0.8

/**
 * Modely, ktoré `temperature` (a ostatné sampling parametre) odmietajú.
 * Overené proti živému API: `claude-sonnet-5` + `temperature` = HTTP 400.
 */
const SAMPLING_FREE_MODEL = /^claude-(fable|mythos)-|^claude-opus-(4-6|4-7|4-8|5)|^claude-sonnet-(4-6|5)/

/**
 * Tvrdý strop na jedno volanie. Routa má `maxDuration = 120`, takže 100 s
 * necháva rezervu na zápis konceptu a na odpoveď do prehliadača.
 */
const AI_TIMEOUT_MS = 100_000

/** Koľko produktov ide modelu do kontextu. Viac = viac šumu, nie viac vkusu. */
export const MAX_PRODUCTS_IN_CONTEXT = 8

/** Rozumné hranice pre text, ktorý má byť blogový článok. */
const MIN_WORDS = 350
const MIN_PARAGRAPHS = 3

export type ArticleSection = {
  heading?: string
  paragraphs: string[]
}

export type ArticleProduct = {
  slug: string
  title: string
}

export type ArticleWriterInput = {
  /** Reálne publikované produkty e-shopu (názov + slug). */
  products?: ArticleProduct[]
  /** Téma/pokyny od majiteľky. */
  prompt: string
}

export type GeneratedArticle = {
  excerpt: string
  metaDescription: string
  metaTitle: string
  sections: ArticleSection[]
  title: string
  wordCount: number
}

export type ArticleUsage = {
  inputTokens: number
  model: string
  outputTokens: number
}

export type ArticleWriterResult =
  | { article: GeneratedArticle; ok: true; usage: ArticleUsage }
  /** `error` je slovenská veta pripravená na zobrazenie v admine. */
  | { error: string; ok: false }

// --- system prompt --------------------------------------------------------

/**
 * Hlas Janky.
 *
 * Toto je jadro celej funkcie — model nedostáva „napíš článok o X", ale
 * konkrétnu autorku s konkrétnym životom a konkrétnym zoznamom vecí, ktoré
 * nerobí. Zákazy sú vymenované menovite, lebo všeobecné „píš prirodzene"
 * model spoľahlivo ignoruje; menovaná fráza sa v texte neobjaví.
 */
const SYSTEM_PROMPT = [
  'IDENTITA',
  `Píšeš ako Janka — 30-ročná mamička dvoch detí, ktorá vedie malý e-shop ${BRAND} s ručne pletenými dekami, hračkami, prútenými dekoráciami a štýlovými doplnkami. Píše blog pre ženy a mamičky.`,
  'Nie si asistent a nikdy sa tak neprezentuješ. Si redaktorka, ktorá píše do svojho blogu.',
  '',
  'HLAS',
  '- Priateľský, milý, familiárny tón. Čitateľkám tykáš.',
  '- Píšeš v prvej osobe („u nás doma", „vyskúšala som", „mne osobne").',
  '- Občas orámuješ text drobnou osobnou skúsenosťou z domácnosti alebo od detí — jednou-dvomi vetami, nie celým príbehom.',
  '- Osobné detaily si vymýšľaj len všeobecné a neoveriteľné (ráno v kuchyni, kôš hračiek pri gauči). Nikdy si nevymýšľaj konkrétne overiteľné fakty o reálnych ľuďoch, značkách, štúdiách, cenách ani dátumoch.',
  '- Gramaticky bezchybná slovenčina vrátane diakritiky, interpunkcie a správnych pádov. Žiadne bohemizmy.',
  '- Odborné tvrdenia o zdraví, bezpečnosti či vývine dieťaťa formuluj opatrne a zo skúsenosti, nie ako poučku.',
  '',
  'ZAKÁZANÉ (toto je najdôležitejšia časť zadania)',
  'Píšeš ako ľudská redaktorka časopisu pre ženy, nie ako jazykový model. Preto NIKDY:',
  '- Nezačínaj generickými AI otvormi typu „V dnešnej uponáhľanej dobe…", „V dnešnej hektickej dobe…", „V tomto článku sa dozviete…", „V tomto článku sa spoločne pozrieme…", „Nie je žiadnym tajomstvom, že…".',
  '- Nepoužívaj prázdne frázy a vatové odseky, ktoré nič nehovoria („je dôležité si uvedomiť, že každý je iný", „možnosti sú takmer neobmedzené").',
  '- Nerob odrážkové zoznamy tam, kde patrí rozprávanie. Tipy zapracuj do viet a odsekov.',
  '- Nekonči slovami „Záverom možno povedať", „Na záver", „Dúfam, že ti tento článok pomohol", „Ak máte akékoľvek otázky".',
  '- Nespamuj emoji. Nepoužívaj ich vôbec.',
  '- Nepíš v abstrakciách („kvalitné materiály", „útulná atmosféra"). Namiesto toho konkrétny zmyslový detail — ako to vonia, aké je to na dotyk, čo počuť, koľko to trvá.',
  '- Nepoužívaj superlatívy a marketingové heslá („najlepší na trhu", „revolučný", „must-have").',
  '- Nepýtaj sa čitateľky v jednom kuse. Na celý článok maximálne jedna rečnícka otázka.',
  '- Nepíš dlhé súvetia jedno za druhým. Striedaj dĺžku viet — po dvoch dlhších daj krátku. Rytmus ľudskej reči.',
  '- Odseky drž krátke (2–5 viet) a prechody medzi nimi prirodzené, bez spojok typu „Okrem toho" a „Navyše" na začiatku každého odseku.',
  '',
  'ŠTRUKTÚRA',
  '- Pútavý úvod bez klišé: vhoď čitateľku rovno do situácie, scény alebo konkrétnej vety, ktorá ju zaujme. Tri odseky pred prvým podnadpisom.',
  '- Tri až štyri podnadpisy (h2) a pod každým ŠTYRI odseky. Podnadpis je konkrétny a vecný, nie „Prečo je to dôležité".',
  '- Odsek má tri až päť viet. Úvod aj sekcie dokopy dajú 600 až 900 slov — to je záväzný rozsah, kratší článok je nedopísaný.',
  '- Rozsah nenaťahuj opakovaním. Radšej pridaj ďalšiu konkrétnu skúsenosť, scénu alebo praktický detail.',
  '- Ľudský záver: posledná myšlienka, pozvanie alebo drobná scéna. Nie zhrnutie toho, čo už bolo napísané.',
  '',
  'PRODUKTY',
  `- V zadaní môžeš dostať zoznam skutočných produktov e-shopu ${BRAND}.`,
  '- Ak sa niektorý prirodzene hodí k téme, spomeň ho ako svoj produkt — tak, ako by si o ňom hovorila kamarátke. Bez tvrdého predaja, najviac DVE zmienky o produktoch v celom článku dokopy.',
  '- Názov z katalógu neprepisuj doslovne, ohni si ho do vety („prútený košík", „naša vlnená deka"). Doslovný názov v strede odseku znie ako cenník.',
  '- Ak sa k téme nehodí ani jeden, nespomínaj žiadny. To je úplne v poriadku a je to lepšie než nasilu vtesnaný produkt.',
  '- NIKDY si nevymysli ďalší ručne robený výrobok, ktorý v zozname nie je — ani ako vec z vlastnej domácnosti. Vymyslený „prútený kočík pre bábiky" alebo „pletený kôš na plienky" vyzerá ako ponuka e-shopu a zákazníčka si ho potom pýta. Keď v texte potrebuješ takú vec spomenúť, napíš ju všeobecne a bez materiálu („kôš na hračky", „debnička pod poličkou").',
  '- Nikdy si nevymýšľaj ceny, rozmery, farby ani materiály, ktoré nie sú v zozname.',
  '',
  'VÝSTUP',
  'Odpovedaj VÝHRADNE jedným JSON objektom, bez sprievodného textu a bez ```-blokov, presne v tomto tvare:',
  '{',
  '  "title": "názov článku vo vetnom tvare (prvé slovo veľkým, ostatné malým, okrem vlastných mien), pútavý, bez clickbaitu a bez dvojbodkových podtitulov",',
  '  "excerpt": "1–2 vety, ktoré článok predstavia vo výpise blogu",',
  '  "sections": [{ "heading": "podnadpis h2 (v prvej sekcii vynechaj)", "paragraphs": ["odsek", "odsek"] }],',
  `  "metaTitle": "maximálne 60 znakov vrátane prípony ' | ${BRAND}', ktorou musí končiť",`,
  `  "metaDescription": "${MIN_DESCRIPTION} až ${MAX_DESCRIPTION} znakov — spočítaj si ich, kratší popis je chyba; celé vety, vecne o čom článok je"`,
  '}',
  'Prvá sekcia je úvod — nechaj jej `heading` prázdny. Každá ďalšia sekcia má `heading` aj `paragraphs`.',
  'Text v `paragraphs` je čistý text bez HTML a bez markdownu (žiadne **, ##, -).',
].join('\n')

const buildUserPrompt = ({ products, prompt }: ArticleWriterInput): string => {
  const lines: string[] = ['Téma a pokyny od majiteľky e-shopu:', prompt.trim()]

  const list = (products ?? []).filter((product) => product?.title)

  if (list.length) {
    // Do promptu ide len názov. `slug` sa načítava a nesie ďalej kvôli
    // prípadnému prelinkovaniu, ale modelu sa nedáva: text článku je čistý
    // text bez odkazov a adresa v strede vety by z neho urobila katalóg.
    lines.push(
      '',
      `Produkty, ktoré práve predávaš (spomeň len tie, ktoré sa k téme naozaj hodia — pokojne aj žiadny):`,
      ...list.map((product) => `- ${product.title}`),
    )
  }

  lines.push('', 'Napíš článok podľa zadania a vráť ho ako JSON.')

  return lines.join('\n')
}

// --- čítanie odpovede -----------------------------------------------------

const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** Z odpovede modelu vytiahne JSON objekt aj spod ```-bloku či vety okolo. */
const extractJson = (text: string): null | Record<string, unknown> => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end <= start) return null

  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
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

const readString = (source: Record<string, unknown>, key: string): string =>
  typeof source[key] === 'string' ? squash(source[key] as string) : ''

/**
 * Zhodí značkovú príponu, ak ju model napísal sám.
 *
 * `buildMetaTitle` zo `src/seo` príponu vždy dopĺňa — bez tohto kroku by
 * vzniklo „Názov | ZAPLETANE | ZAPLETANE". (V SEO module to rieši neexportovaná
 * `normalizeAiTitle`; kopírujeme teda jeden riadok, nie celý súbor.)
 */
const stripBrandSuffix = (value: string): string =>
  value.replace(new RegExp(`\\s*\\|\\s*${BRAND}\\s*$`, 'i'), '').trim()

/**
 * Cyrilské dvojníčky latinských písmen.
 *
 * Modely občas uprostred slovenského slova vypustia znak z cyriliky, ktorý
 * vyzerá rovnako („prúteнom" s cyrilským „н"). V texte je to neviditeľné, ale
 * je to iné písmeno: rozbije to vyhľadávanie, delenie slov aj kontrolu
 * pravopisu. Slovenský článok cyriliku nepotrebuje, takže sa tieto znaky
 * mlčky prepíšu na latinku.
 */
const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', З: '3', И: 'N', К: 'K', М: 'M', Н: 'H', О: 'O',
  Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', а: 'a', в: 'v', е: 'e', и: 'i',
  к: 'k', м: 'm', н: 'n', о: 'o', р: 'p', с: 's', т: 't', у: 'u', х: 'h',
  і: 'i', ѕ: 's', ј: 'j',
}

const deconfuse = (value: string): string =>
  value.replace(/[Ѐ-ӿ]/gu, (char) => CYRILLIC_LOOKALIKES[char] ?? char)

/** Odstráni markdown, ktorý sa modelu občas ujde aj napriek zákazu. */
const stripMarkdown = (value: string): string =>
  squash(
    deconfuse(value)
      .replace(/^\s*#{1,6}\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2'),
  )

const readSections = (value: unknown): ArticleSection[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry): ArticleSection => {
      const source = (entry ?? {}) as Record<string, unknown>
      const heading = stripMarkdown(readString(source, 'heading'))
      const raw = Array.isArray(source.paragraphs) ? source.paragraphs : []
      const paragraphs = raw
        .map((paragraph) => (typeof paragraph === 'string' ? stripMarkdown(paragraph) : ''))
        .filter(Boolean)

      return heading ? { heading, paragraphs } : { paragraphs }
    })
    .filter((section) => section.paragraphs.length > 0)
}

export const countWords = (sections: ArticleSection[]): number =>
  sections.reduce(
    (total, section) =>
      total +
      (section.heading ? section.heading.split(' ').filter(Boolean).length : 0) +
      section.paragraphs.reduce(
        (sum, paragraph) => sum + paragraph.split(' ').filter(Boolean).length,
        0,
      ),
    0,
  )

/**
 * Meta popis do okna 140–160 znakov.
 *
 * Na rozdiel od produktov sa nedopĺňa značkovými vetami („Objednávajte
 * online…") — tie sedia na produktovú kartu, nie na článok. Krátky popis sa
 * dotiahne **celými vetami z perexu**, lebo perex je jediný text, ktorý článok
 * zhŕňa; veta vytiahnutá z tela článku znie mimo kontextu („…prečo menej
 * hračiek býva viac. Položila som ho späť.").
 *
 * Keď sa nezmestí ani jedna celá veta, popis ostane kratší než 140 znakov.
 * To je v poriadku: 131 znakov vyhľadávaču neprekáža, useknutá veta áno.
 */
const clampArticleDescription = (raw: string, ...fallbacks: string[]): string => {
  let text = squash(raw)

  if (text.length > MAX_DESCRIPTION) {
    const slice = text.slice(0, MAX_DESCRIPTION + 1)
    const lastSpace = slice.lastIndexOf(' ')
    const cut = (
      lastSpace > MIN_DESCRIPTION ? slice.slice(0, lastSpace) : text.slice(0, MAX_DESCRIPTION)
    ).replace(/[\s,.;:–—-]+$/u, '')

    return /[.!?…]$/u.test(cut) ? cut : `${cut}.`
  }

  if (!text) return text

  if (!/[.!?…]$/u.test(text)) text = `${text}.`

  for (const extra of fallbacks) {
    if (text.length >= MIN_DESCRIPTION) break

    for (const sentence of squash(extra).match(/[^.!?…]+[.!?…]+/gu) ?? []) {
      if (text.length >= MIN_DESCRIPTION) break

      const candidate = squash(`${text} ${sentence}`)

      if (candidate.length <= MAX_DESCRIPTION && candidate.length > text.length) text = candidate
    }
  }

  return text
}

/**
 * Najotrepanejšie AI frázy. Keď sa niektorá objaví, generovanie sa vyhlási za
 * neúspešné — presne pred týmto štýlom má zadanie chrániť a je lacnejšie dať
 * majiteľke tlačidlo „skús znova" než nechať taký odsek na webe.
 *
 * Zoznam je zámerne krátky a doslovný: chytá len formulácie, ktoré ľudská
 * redaktorka nenapíše, takže falošný poplach prakticky nehrozí.
 */
const SLOP_PATTERNS: RegExp[] = [
  /v dnešnej (uponáhľanej|hektickej|rýchlej|modernej) dobe/i,
  /v tomto článku (sa dozviete|sa pozrieme|vám predstavíme|sa spoločne)/i,
  /záverom (možno povedať|by som|len toľko)/i,
  /dúfam(e)?, že (vám |ti )?(tento )?článok (pomohol|pomôže)/i,
  /ak máte akékoľvek otázky/i,
]

const findSlop = (article: GeneratedArticle): null | string => {
  const haystack = [
    article.title,
    article.excerpt,
    ...article.sections.flatMap((section) => [section.heading ?? '', ...section.paragraphs]),
  ].join('\n')

  for (const pattern of SLOP_PATTERNS) {
    const hit = haystack.match(pattern)

    if (hit) return hit[0]
  }

  return null
}

// --- volanie modelu -------------------------------------------------------

type CallResult =
  | { error: string; ok: false }
  | { ok: true; payload: unknown }

const callClaude = async (
  body: Record<string, unknown>,
  apiKey: string,
): Promise<CallResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      body: JSON.stringify(body),
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
      const detail = await response.text().catch(() => '')

      return { error: `HTTP ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`, ok: false }
    }

    return { ok: true, payload: await response.json() }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'

    return {
      error: aborted ? `časový limit ${Math.round(AI_TIMEOUT_MS / 1000)} s` : String(error),
      ok: false,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Napíše článok.
 *
 * Nehádže výnimky — každá cesta končí buď hotovým článkom, alebo slovenskou
 * vetou v `error`, ktorú vie admin rovno ukázať.
 */
export const generateArticle = async (input: ArticleWriterInput): Promise<ArticleWriterResult> => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    return { error: 'Chýba kľúč k AI (ANTHROPIC_API_KEY). Bez neho sa článok vygenerovať nedá.', ok: false }
  }

  const prompt = squash(input.prompt || '')

  if (prompt.length < 5) {
    return { error: 'Zadaj tému alebo pokyny pre článok — bez nich model nemá o čom písať.', ok: false }
  }

  const model = process.env.ANTHROPIC_ARTICLE_MODEL?.trim() || DEFAULT_MODEL

  const body: Record<string, unknown> = {
    max_tokens: MAX_TOKENS,
    messages: [
      { content: buildUserPrompt({ products: input.products, prompt }), role: 'user' },
    ],
    model,
    system: SYSTEM_PROMPT,
  }

  // Staršie modely kreativitu cez `temperature` ešte vedia; novšie ju odmietnu.
  if (!SAMPLING_FREE_MODEL.test(model)) body.temperature = TEMPERATURE

  let call = await callClaude(body, apiKey)

  // Poistka pre modely nastavené cez env, o ktorých zoznam vyššie nevie.
  if (!call.ok && 'temperature' in body && /temperature/i.test(call.error)) {
    delete body.temperature
    call = await callClaude(body, apiKey)
  }

  if (!call.ok) {
    return { error: `AI neodpovedala (${call.error}). Skús to o chvíľu znova.`, ok: false }
  }

  const parsed = extractJson(responseText(call.payload))

  if (!parsed) {
    return { error: 'AI vrátila odpoveď, ktorej sa nedalo rozumieť. Skús to znova.', ok: false }
  }

  const sections = readSections(parsed.sections)
  const paragraphCount = sections.reduce((total, section) => total + section.paragraphs.length, 0)
  const title = stripMarkdown(readString(parsed, 'title'))
  const wordCount = countWords(sections)

  if (!title || !sections.length) {
    return { error: 'AI vrátila neúplný článok (chýba názov alebo text). Skús to znova.', ok: false }
  }

  if (paragraphCount < MIN_PARAGRAPHS || wordCount < MIN_WORDS) {
    return {
      error: `AI vrátila príliš krátky text (${wordCount} slov). Skús to znova, prípadne zadaj konkrétnejšiu tému.`,
      ok: false,
    }
  }

  // Bez perexu by karta vo výpise ostala prázdna — zastúpi ho prvý odsek.
  const excerpt = stripMarkdown(readString(parsed, 'excerpt')) || sections[0]!.paragraphs[0]!

  const article: GeneratedArticle = {
    excerpt,
    metaDescription: clampArticleDescription(
      readString(parsed, 'metaDescription') || excerpt,
      excerpt,
    ),
    metaTitle: buildMetaTitle(stripBrandSuffix(readString(parsed, 'metaTitle')) || title),
    sections,
    title,
    wordCount,
  }

  const slop = findSlop(article)

  if (slop) {
    return {
      error: `AI skĺzla do typickej frázy („${slop}"). Článok sa neuložil — skús to znova.`,
      ok: false,
    }
  }

  const usage = (call.payload as { usage?: Record<string, unknown> })?.usage ?? {}

  return {
    article,
    ok: true,
    usage: {
      inputTokens: Number(usage.input_tokens ?? 0),
      model,
      outputTokens: Number(usage.output_tokens ?? 0),
    },
  }
}

export { SYSTEM_PROMPT as ARTICLE_SYSTEM_PROMPT }
