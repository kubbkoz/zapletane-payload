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
 * Okrem textu článku vzniká v tom istom volaní aj sada **promptov na obrázky**
 * (Z19). Každý prompt sa viaže na jeden skutočný produkt z katalógu, lebo
 * majiteľka k nemu v generátore obrázkov priloží jeho fotku ako referenciu —
 * vymyslený produkt by znamenal prompt, ku ktorému neexistuje fotka. Prompty
 * sú doplnok: keď sa ich nepodarí prečítať, článok sa uloží aj tak.
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

/**
 * Strop na dĺžku odpovede. Článok 600–900 slov + meta + prompty na obrázky.
 * Z 6000 na 8000 práve kvôli promptom (Z19): štyri anglické pasáže po 40–80
 * slovách sú ďalších ~600 tokenov a bez rezervy by sa odpoveď useknutá
 * uprostred JSON-u nedala prečítať vôbec.
 */
const MAX_TOKENS = 8000

/** Nepovinná kreativita pre staršie modely; novšie ju odmietajú (viď hlavičku). */
const TEMPERATURE = 0.8

/**
 * Modely, ktoré `temperature` (a ostatné sampling parametre) odmietajú.
 * Overené proti živému API: `claude-sonnet-5` + `temperature` = HTTP 400.
 */
const SAMPLING_FREE_MODEL = /^claude-(fable|mythos)-|^claude-opus-(4-6|4-7|4-8|5)|^claude-sonnet-(4-6|5)/

/**
 * Tvrdý strop na jedno volanie.
 *
 * Pôvodných 100 s stačilo na samotný článok (~2 900 tokenov, ~75 s). Prompty na
 * obrázky pridali ďalších 400–700 tokenov v tom istom volaní a merania to
 * potvrdili: článok so štyrmi návrhmi 100 s prekročil a majiteľka videla
 * „AI neodpovedala (časový limit)" namiesto hotového textu. Strop je preto 150 s
 * a routa má `maxDuration = 180` — rezerva na zápis konceptu a odpoveď ostáva
 * rovnaká ako predtým.
 */
const AI_TIMEOUT_MS = 150_000

/**
 * Koľko produktov ide modelu do kontextu.
 *
 * Pôvodne osem („viac = viac šumu, nie viac vkusu"). Od Z19 dvadsaťpäť: z toho
 * istého zoznamu sa vyberajú aj produkty do promptov na obrázky a pri ôsmich
 * najnovšie upravených položkách by sa k téme článku často nehodil ani jeden.
 * Do textu článku aj tak smú ísť najviac dve zmienky — o tom rozhoduje systémový
 * prompt, nie dĺžka zoznamu.
 */
export const MAX_PRODUCTS_IN_CONTEXT = 25

/** Koľko obrázkov navrhnúť k jednému článku. */
const MIN_IMAGE_PROMPTS = 2
const MAX_IMAGE_PROMPTS = 4

/**
 * Strop na jeden prompt a na celé pole `aiImagePrompts`.
 *
 * Musí sedieť s `maxLength` poľa v `src/collections/Posts.ts` — dlhší text by
 * `payload.update` odmietol a spadol by s ním zápis celého (hotového) článku.
 */
const MAX_IMAGE_PROMPT_CHARS = 700
export const MAX_IMAGE_PROMPTS_CHARS = 4000

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

/**
 * Jeden návrh obrázka (Z19).
 *
 * `product` je vždy presný názov z katalógu — majiteľka podľa neho nájde fotku
 * v galérii produktu a priloží ju k promptu. `prompt` je po anglicky, lebo
 * obrazové modely (Midjourney, DALL·E, Higgsfield) rozumejú angličtine
 * najspoľahlivejšie; slovenské ostávajú len popisné riadky okolo neho.
 */
export type ArticleImagePrompt = {
  /** Podnadpis sekcie článku, pod ktorú obrázok patrí (presne ako v texte). */
  heading: string
  /** Presný názov produktu z katalógu. */
  product: string
  /** Samotný prompt pre obrazový model — po anglicky. */
  prompt: string
}

export type ArticleWriterInput = {
  /** Reálne publikované produkty e-shopu (názov + slug). */
  products?: ArticleProduct[]
  /** Téma/pokyny od majiteľky. */
  prompt: string
}

export type GeneratedArticle = {
  excerpt: string
  /** Návrhy obrázkov. Prázdne pole je legitímny výsledok, nie chyba. */
  imagePrompts: ArticleImagePrompt[]
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
  'OBRÁZKY DO ČLÁNKU',
  `- K článku navrhni ${MIN_IMAGE_PROMPTS} až ${MAX_IMAGE_PROMPTS} obrázkov — prompty pre generátor obrázkov (Midjourney, DALL·E, Higgsfield).`,
  '- Každý obrázok stojí na JEDNOM skutočnom produkte zo zoznamu vyššie. Majiteľka k promptu priloží fotku toho produktu ako referenciu, takže vymyslený produkt = prompt, ku ktorému neexistuje fotka.',
  '- `product` je presný názov zo zoznamu, znak po znaku — neskracuj ho, neprekladaj, neohýbaj do vety (na rozdiel od textu článku). Produkt, ktorý v zozname nie je, nesmieš použiť ani náhodou.',
  '- Každý obrázok pod inú sekciu. `heading` je presný podnadpis (h2) z tvojho článku, skopírovaný znak po znaku.',
  '- `prompt` píš PO ANGLICKY, 35 až 60 slov, súvislý popis bez odrážok: scéna, kompozícia, svetlo, nálada. Drž sa tejto dĺžky — dlhší prompt obrazový model neposlúchne lepšie, len predlžuje čakanie na článok.',
  '  Štýl značky: cozy handmade wicker and knitted aesthetic, warm natural daylight, soft shadows, muted natural palette, editorial lifestyle photography, realistic photo.',
  '  V každom prompte výslovne napíš, že priložený referenčný produkt je na zábere nezmenený a dobre viditeľný — napríklad „the attached reference product shown exactly as in the reference photo, unchanged, prominently in frame".',
  '  Na konci promptu vždy: „no text overlays, no logos, no watermarks".',
  '- Prompt opisuje scénu okolo produktu, nie katalógovú fotku na bielom pozadí. Žiadne ceny, nápisy ani tváre v detaile.',
  '- Ak zoznam produktov nedostaneš, je prázdny alebo sa k téme nehodí ani jeden, vráť `imagePrompts` ako prázdne pole `[]`. Prázdny zoznam je správna odpoveď, vymyslený produkt nikdy.',
  '',
  'VÝSTUP',
  'Odpovedaj VÝHRADNE jedným JSON objektom, bez sprievodného textu a bez ```-blokov, presne v tomto tvare:',
  '{',
  '  "title": "názov článku vo vetnom tvare (prvé slovo veľkým, ostatné malým, okrem vlastných mien), pútavý, bez clickbaitu a bez dvojbodkových podtitulov",',
  '  "excerpt": "1–2 vety, ktoré článok predstavia vo výpise blogu",',
  '  "sections": [{ "heading": "podnadpis h2 (v prvej sekcii vynechaj)", "paragraphs": ["odsek", "odsek"] }],',
  `  "metaTitle": "maximálne 60 znakov vrátane prípony ' | ${BRAND}', ktorou musí končiť",`,
  `  "metaDescription": "${MIN_DESCRIPTION} až ${MAX_DESCRIPTION} znakov — spočítaj si ich, kratší popis je chyba; celé vety, vecne o čom článok je",`,
  '  "imagePrompts": [{ "heading": "presný podnadpis sekcie z tohto článku", "product": "presný názov produktu zo zoznamu", "prompt": "image prompt in English" }]',
  '}',
  'Prvá sekcia je úvod — nechaj jej `heading` prázdny. Každá ďalšia sekcia má `heading` aj `paragraphs`.',
  'Text v `paragraphs` je čistý text bez HTML a bez markdownu (žiadne **, ##, -).',
].join('\n')

const buildUserPrompt = ({ products, prompt }: ArticleWriterInput): string => {
  const lines: string[] = ['Téma a pokyny od majiteľky e-shopu:', prompt.trim()]

  const list = (products ?? [])
    .filter((product) => product?.title)
    .slice(0, MAX_PRODUCTS_IN_CONTEXT)

  if (list.length) {
    // Do promptu ide len názov. `slug` sa načítava a nesie ďalej kvôli
    // prípadnému prelinkovaniu, ale modelu sa nedáva: text článku je čistý
    // text bez odkazov a adresa v strede vety by z neho urobila katalóg.
    lines.push(
      '',
      `Produkty, ktoré práve predávaš (spomeň len tie, ktoré sa k téme naozaj hodia — pokojne aj žiadny). Z tohto zoznamu vyberáš aj produkty do promptov na obrázky, a to presným názvom:`,
      ...list.map((product) => `- ${product.title}`),
    )
  } else {
    // Bez katalógu nie je ku ktorej fotke prompt priložiť.
    lines.push('', 'Zoznam produktov teraz nie je k dispozícii — vráť `imagePrompts` ako prázdne pole.')
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

// --- návrhy obrázkov (Z19) ------------------------------------------------

/** Kratší „prompt" je preklep alebo pozostatok, nie zadanie pre obrazový model. */
const MIN_IMAGE_PROMPT_CHARS = 40

/**
 * Kľúč na porovnávanie názvov.
 *
 * Model názov produktu občas prepíše bez úvodzoviek, s inou veľkosťou písmen
 * alebo bez diakritiky. To nie je vymyslený produkt, len iný zápis toho istého,
 * takže sa porovnáva zjednodušený tvar — a do výstupu ide vždy názov
 * z katalógu, nie ten modelov.
 */
const foldKey = (value: string): string =>
  squash(deconfuse(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()

/**
 * Nájde produkt v katalógu. Keď taký neexistuje, vráti `null` — a blok padá.
 *
 * Toto je jediná poistka proti tomu, aby majiteľka dostala prompt na „prútený
 * kočík pre bábiky", ku ktorému v obchode neexistuje fotka. Systémový prompt to
 * zakazuje, tu sa to kontroluje.
 */
const matchProduct = (claimed: string, catalogue: Map<string, string>): null | string => {
  const key = foldKey(claimed)

  if (!key) return null

  const exact = catalogue.get(key)

  if (exact) return exact

  // Zhoda „na obsah" len pri dosť dlhom názve: „deka" by sedela na čokoľvek.
  if (key.length < 6) return null

  for (const [candidateKey, title] of catalogue) {
    if (candidateKey.includes(key) || key.includes(candidateKey)) return title
  }

  return null
}

/**
 * Priradí obrázok k skutočnej sekcii článku.
 *
 * Nadpis sa berie z článku, nie z odpovede modelu: majiteľka podľa neho hľadá
 * miesto v texte a nesedel by jej tam preklep ani voľný prepis. Keď sa
 * nepodarí spárovať nič, obrázok sa priradí prvej nepoužitej sekcii — dva
 * návrhy pod tú istú sekciu vyzerajú ako chyba.
 */
const pickHeading = (claimed: string, headings: string[], used: Set<string>): null | string => {
  if (!headings.length) return null

  const key = foldKey(claimed)
  const exact = key ? headings.find((heading) => foldKey(heading) === key) : undefined

  if (exact) return exact

  const partial =
    key.length >= 6
      ? headings.find((heading) => foldKey(heading).includes(key) || key.includes(foldKey(heading)))
      : undefined

  if (partial) return partial

  return headings.find((heading) => !used.has(heading)) ?? headings[headings.length - 1]!
}

const clampPrompt = (value: string): string => {
  const text = stripMarkdown(value)

  if (text.length <= MAX_IMAGE_PROMPT_CHARS) return text

  const slice = text.slice(0, MAX_IMAGE_PROMPT_CHARS)
  const lastSpace = slice.lastIndexOf(' ')

  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:–—-]+$/u, '')
}

/**
 * Prečíta návrhy obrázkov z odpovede.
 *
 * Nikdy nehádže a nikdy nezhodí článok: čo sa nedá overiť, to sa ticho zahodí.
 * Prázdne pole je legitímny výsledok — majiteľka si obrázky doplní sama, kým
 * zlý prompt by ju poslal generovať fotku produktu, ktorý nepredáva.
 */
const readImagePrompts = (
  value: unknown,
  context: { headings: string[]; products: string[] },
): ArticleImagePrompt[] => {
  if (!Array.isArray(value) || !context.headings.length || !context.products.length) return []

  const catalogue = new Map(context.products.map((title) => [foldKey(title), title]))
  const used = new Set<string>()
  const seen = new Set<string>()
  const prompts: ArticleImagePrompt[] = []

  for (const entry of value) {
    if (prompts.length >= MAX_IMAGE_PROMPTS) break

    const source = (entry ?? {}) as Record<string, unknown>
    const product = matchProduct(readString(source, 'product'), catalogue)
    const prompt = clampPrompt(readString(source, 'prompt'))

    if (!product || prompt.length < MIN_IMAGE_PROMPT_CHARS) continue

    const heading = pickHeading(readString(source, 'heading'), context.headings, used)

    if (!heading) continue

    const key = `${foldKey(product)}|${foldKey(prompt)}`

    if (seen.has(key)) continue

    seen.add(key)
    used.add(heading)
    prompts.push({ heading, product, prompt })
  }

  return prompts
}

/**
 * Návrhy → text do poľa „Návrhy obrázkov (AI)".
 *
 * Tvar je čitateľný blok na skopírovanie: dva slovenské riadky pre majiteľku
 * (kam obrázok patrí a ktorú fotku priložiť) a jeden anglický riadok pre
 * obrazový model. Bloky oddeľuje prázdny riadok.
 *
 * Do `MAX_IMAGE_PROMPTS_CHARS` sa vojde vždy: keď by posledný blok limit
 * prekročil, vynechá sa celý. Polovičný prompt je horší než o jeden menej —
 * a `maxLength` poľa by inak zhodilo uloženie hotového článku.
 */
export const formatImagePrompts = (prompts: ArticleImagePrompt[]): string => {
  const blocks: string[] = []
  let length = 0

  for (const entry of prompts) {
    const block = [
      `OBRÁZOK ${blocks.length + 1} — umiestnenie: pod sekciou „${entry.heading}"`,
      `Produkt: ${entry.product} (k promptu priložte fotku tohto produktu z jeho galérie)`,
      `Prompt: ${entry.prompt}`,
    ].join('\n')

    const next = length + block.length + (blocks.length ? 2 : 0)

    if (next > MAX_IMAGE_PROMPTS_CHARS) break

    blocks.push(block)
    length = next
  }

  return blocks.join('\n\n')
}

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

/**
 * Kontroluje sa **len text článku** — názov, perex a sekcie.
 *
 * Návrhy obrázkov (`imagePrompts`) do kontroly zámerne nevstupujú: sú po
 * anglicky, na web sa nedostanú a slovenské frázy v nich nemajú čo hľadať.
 * Rozšíriť sem tento zoznam by znamenalo zhodiť hotový článok kvôli poznámke
 * v postrannom paneli.
 */
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
    // Prompty sa overujú proti hotovému článku: produkt musí byť z katalógu,
    // nadpis zo skutočných sekcií. Čo neprejde, ticho vypadne.
    imagePrompts: readImagePrompts(parsed.imagePrompts, {
      headings: sections.map((section) => section.heading ?? '').filter(Boolean),
      products: (input.products ?? [])
        .map((product) => product?.title ?? '')
        .filter(Boolean)
        .slice(0, MAX_PRODUCTS_IN_CONTEXT),
    }),
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
