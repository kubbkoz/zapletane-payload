import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

/**
 * Automatické SEO/GEO meta pre produkty.
 *
 * Dva motory, jedno rozhranie:
 *   a) Claude (Anthropic Messages API) — keď je nastavený `ANTHROPIC_API_KEY`.
 *      Priamy `fetch`, žiadna SDK závislosť (projekt zámerne nepridáva balíky).
 *   b) Šablóna — deterministická slovenská veta poskladaná z popisu, materiálu,
 *      rozmerov a ceny. Beží vždy, keď kľúč chýba *alebo* keď AI zlyhá.
 *
 * Kontrakt, na ktorý sa spolieha hook aj admin tlačidlo „Generovať":
 *   - `generateProductMeta` NIKDY nehodí výnimku a NIKDY nebeží dlhšie než
 *     `AI_TIMEOUT_MS`; po timeoute vyhráva šablóna.
 *   - dĺžky sú vždy v medziach (title <= 60 vrátane brandu, description 140–160),
 *     nech už text prišiel odkiaľkoľvek — normalizácia je spoločná pre oba motory.
 */

const BRAND = (process.env.SITE_NAME || 'ZAPLETANE').trim() || 'ZAPLETANE'
const BRAND_SUFFIX = ` | ${BRAND}`

/** Google ukáže cca 60 znakov titulku a ~155–160 znakov popisu. */
export const MAX_TITLE = 60
export const MIN_DESCRIPTION = 140
export const MAX_DESCRIPTION = 160

/**
 * Model ID bez dátumovej prípony — dátumované varianty sú staršia konvencia a
 * na aktuálnom API vracajú 404. Prepísateľné cez `ANTHROPIC_SEO_MODEL`, keby
 * bolo treba iný model bez zásahu do kódu.
 */
const DEFAULT_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Tvrdý strop na AI vetvu. Hook na `create` musí dobehnúť aj keď je API
 * nedostupné — 10 s je s rezervou pod 12 s limitom, ktorý si dáva admin UI.
 */
const AI_TIMEOUT_MS = 10_000

export type SeoPropertyInput = {
  name?: null | string
  unit?: null | string
  value?: null | string
}

export type SeoDimensionsInput = {
  depth?: null | number
  height?: null | number
  weight?: null | number
  width?: null | number
}

export type SeoProductInput = {
  categories?: null | string[]
  /** Lexical editor state alebo už hotový plain text. */
  description?: unknown
  dimensions?: null | SeoDimensionsInput
  /** Cena v eurocentoch (tak, ako ju drží `products.priceInEUR`). */
  price?: null | number
  properties?: null | SeoPropertyInput[]
  title: string
}

export type GeneratedMeta = {
  /** Ktorý motor text vyrobil — pre logy a testy, do dokumentu sa neukladá. */
  engine: 'ai' | 'template'
  metaDescription: string
  metaTitle: string
}

// --- malé textové pomôcky -------------------------------------------------

const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** Odsekne vetu na hranici slova; nikdy neprekročí `max`. */
const cutAtWord = (text: string, max: number): string => {
  if (text.length <= max) return text

  const slice = text.slice(0, max + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > Math.floor(max / 2) ? slice.slice(0, lastSpace) : text.slice(0, max)

  return cut.replace(/[\s,.;:–—-]+$/u, '')
}

const endsWithSentence = (text: string): boolean => /[.!?…]$/u.test(text)

/** Doplní bodku, a keď sa už nezmestí, spraví na ňu miesto. */
const finishSentence = (text: string, max: number): string => {
  if (!text || endsWithSentence(text)) return text

  return text.length < max ? `${text}.` : `${text.slice(0, max - 1)}.`
}

// --- šablónový motor ------------------------------------------------------

/**
 * Doplnkové vety, ktorými sa krátky popis dotiahne na minimálnu dĺžku.
 * Zoradené od najdlhšej — berie sa prvá, ktorá sa ešte zmestí.
 */
const FILLERS = [
  'Ručná práca z prírodných materiálov, každý kus je originál.',
  'Objednávajte online, doručíme po celom Slovensku.',
  'Ručná výroba, originálny kus.',
  'Ručná výroba.',
]

const MATERIAL_PATTERN = /materi[áa]l/i

/** Lexical state -> plain text. Rovnaký util, aký používajú produktové feedy. */
export const descriptionToPlaintext = (description: unknown): string => {
  if (!description) return ''
  if (typeof description === 'string') return squash(description)

  try {
    return squash(convertLexicalToPlaintext({ data: description as SerializedEditorState }))
  } catch {
    // Jeden pokazený editor state nesmie zhodiť ukladanie produktu.
    return ''
  }
}

/** Eurocenty -> „24,90 €" (slovenský desatinný oddeľovač). */
export const formatPrice = (price?: null | number): null | string => {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null

  return `${(price / 100).toFixed(2).replace('.', ',')} €`
}

const propertyText = (property: SeoPropertyInput): null | string => {
  const value = property.value?.trim()

  if (!value) return null

  const unit = property.unit?.trim()

  if (!unit || value.toLowerCase().endsWith(unit.toLowerCase())) return value

  return `${value} ${unit}`
}

/** Hodnota vlastnosti „Materiál" (alebo prvá vyplnená vlastnosť ako náhrada). */
export const findMaterial = (properties?: null | SeoPropertyInput[]): null | string => {
  const filled = (properties ?? []).filter((entry) => entry && entry.value?.trim())

  if (!filled.length) return null

  const material = filled.find((entry) => MATERIAL_PATTERN.test(entry.name ?? ''))

  return propertyText(material ?? filled[0]!)
}

const formatNumber = (value: number): string => String(Number(value.toFixed(2))).replace('.', ',')

/** „Rozmery 30 × 40 cm." / „Hmotnosť 250 g." — len z vyplnených hodnôt. */
export const formatDimensions = (dimensions?: null | SeoDimensionsInput): null | string => {
  if (!dimensions) return null

  const sizes = [dimensions.width, dimensions.height, dimensions.depth].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  )

  const parts: string[] = []

  if (sizes.length) parts.push(`Rozmery ${sizes.map(formatNumber).join(' × ')} cm.`)

  const weight = dimensions.weight

  if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
    parts.push(`Hmotnosť ${formatNumber(weight)} g.`)
  }

  return parts.length ? parts.join(' ') : null
}

/**
 * Titulok: `<názov> | ZAPLETANE`, skrátený na hranici slova.
 * Brand sa obetuje až vtedy, keď by vedľa neho nezostal zmysluplný názov.
 */
export const buildMetaTitle = (rawTitle: string): string => {
  const title = squash(rawTitle || '')

  if (!title) return BRAND

  const full = `${title}${BRAND_SUFFIX}`

  if (full.length <= MAX_TITLE) return full

  const room = MAX_TITLE - BRAND_SUFFIX.length

  if (room >= 15) return `${cutAtWord(title, room)}${BRAND_SUFFIX}`

  return cutAtWord(title, MAX_TITLE)
}

/**
 * Zoradí ľubovoľný text do okna 140–160 znakov: najprv oreže, potom prípadne
 * doplní značkovou vetou. Používa sa aj na výstup z AI, aby limity platili
 * bez ohľadu na to, čo model vrátil.
 */
export const clampDescription = (raw: string): string => {
  let text = squash(raw)

  if (!text) return ''

  if (text.length > MAX_DESCRIPTION) text = cutAtWord(text, MAX_DESCRIPTION)

  for (const filler of FILLERS) {
    if (text.length >= MIN_DESCRIPTION) break

    const candidate = `${finishSentence(text, MAX_DESCRIPTION)} ${filler}`

    if (candidate.length <= MAX_DESCRIPTION) text = candidate
  }

  return finishSentence(text, MAX_DESCRIPTION)
}

/**
 * Deterministický popis: úvod z produktového textu + fakty (materiál, rozmery,
 * cena). Fakty majú prednosť — úvod dostane len toľko miesta, koľko po nich
 * zostane, lebo práve fakty robia popis užitočným pre vyhľadávače aj pre LLM.
 */
export const buildMetaDescription = (input: SeoProductInput): string => {
  const title = squash(input.title || '')
  const plain = descriptionToPlaintext(input.description)
  const lead = plain || (title ? `${title} — ručne vyrobený kúsok z dielne ${BRAND}.` : '')

  const facts: string[] = []
  const material = findMaterial(input.properties)

  if (material) facts.push(`Materiál: ${material}.`)

  const dimensions = formatDimensions(input.dimensions)

  if (dimensions) facts.push(dimensions)

  const price = formatPrice(input.price)

  if (price) facts.push(`Cena ${price}.`)

  const tail = facts.join(' ')
  const room = tail ? MAX_DESCRIPTION - tail.length - 1 : MAX_DESCRIPTION

  // Úvod sa zaradí len ak z neho zostane čitateľný kus vety.
  const head = lead && room >= 40 ? finishSentence(cutAtWord(lead, room), room) : ''

  return clampDescription([head, tail].filter(Boolean).join(' '))
}

/** Celé šablónové meta. Synchrónne — je to záchranná sieť AI vetvy. */
export const buildTemplateMeta = (input: SeoProductInput): GeneratedMeta => ({
  engine: 'template',
  metaDescription: buildMetaDescription(input),
  metaTitle: buildMetaTitle(input.title),
})

// --- AI motor (Claude) ----------------------------------------------------

const SYSTEM_PROMPT = [
  `Si skúsený slovenský e-shop copywriter pre značku ${BRAND} — ručne pletené a prútené výrobky pre domov.`,
  'Píšeš SEO meta údaje v prirodzenej spisovnej slovenčine.',
  'Pravidlá:',
  `- metaTitle: maximálne ${MAX_TITLE} znakov VRÁTANE prípony "${BRAND_SUFFIX}", ktorou musí končiť.`,
  `- metaDescription: ${MIN_DESCRIPTION} až ${MAX_DESCRIPTION} znakov, celé vety zakončené bodkou.`,
  '- Píš konkrétne a vecne: čo to je, z čoho to je, aké má rozmery, komu to poslúži.',
  '- Ak poznáš materiál alebo rozmery, spomeň ich.',
  '- Žiadny clickbait, žiadne superlatívy typu "najlepší", žiadne výkričníky, žiadne emoji.',
  '- Nevymýšľaj vlastnosti, ktoré nie sú v zadaní.',
  'Odpovedaj VÝHRADNE jedným JSON objektom v tvare {"metaTitle": "...", "metaDescription": "..."} bez akéhokoľvek ďalšieho textu.',
].join('\n')

const buildUserPrompt = (input: SeoProductInput): string => {
  const lines: string[] = [`Názov produktu: ${squash(input.title || '')}`]

  const plain = descriptionToPlaintext(input.description)

  if (plain) lines.push(`Popis produktu: ${plain.slice(0, 1500)}`)

  const properties = (input.properties ?? [])
    .map((entry) => {
      const name = entry?.name?.trim()
      const value = propertyText(entry ?? {})

      return name && value ? `${name}: ${value}` : null
    })
    .filter((line): line is string => Boolean(line))

  if (properties.length) lines.push(`Vlastnosti: ${properties.join('; ')}`)

  const dimensions = formatDimensions(input.dimensions)

  if (dimensions) lines.push(`Rozmery: ${dimensions}`)

  const categories = (input.categories ?? []).filter(Boolean)

  if (categories.length) lines.push(`Kategórie: ${categories.join(', ')}`)

  const price = formatPrice(input.price)

  if (price) lines.push(`Cena: ${price}`)

  lines.push('Vygeneruj metaTitle a metaDescription pre stránku tohto produktu.')

  return lines.join('\n')
}

/**
 * Z odpovede modelu vytiahne JSON objekt. Model má inštrukciu vrátiť čistý
 * JSON, ale obranne počítame aj s ```json blokom a s vetou okolo neho.
 */
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

/** Titulok z AI: brand prípona je povinná, dĺžka sa doráta rovnako ako v šablóne. */
const normalizeAiTitle = (raw: string, fallbackTitle: string): string => {
  const title = squash(raw)

  if (!title) return buildMetaTitle(fallbackTitle)

  const withoutBrand = title.replace(new RegExp(`\\s*\\|\\s*${BRAND}\\s*$`, 'i'), '').trim()

  return buildMetaTitle(withoutBrand || fallbackTitle)
}

/**
 * Jedno volanie Claude API. Vracia `null` pri akomkoľvek probléme (chýbajúci
 * kľúč, sieť, HTTP chyba, nečitateľná odpoveď) — volajúci potom použije šablónu.
 */
const generateWithClaude = async (input: SeoProductInput): Promise<GeneratedMeta | null> => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      body: JSON.stringify({
        max_tokens: 300,
        messages: [{ content: buildUserPrompt(input), role: 'user' }],
        model: process.env.ANTHROPIC_SEO_MODEL?.trim() || DEFAULT_MODEL,
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

    if (!response.ok) return null

    const parsed = extractJson(responseText(await response.json()))

    if (!parsed) return null

    const metaTitle = typeof parsed.metaTitle === 'string' ? parsed.metaTitle : ''
    const metaDescription =
      typeof parsed.metaDescription === 'string' ? parsed.metaDescription : ''

    // Prázdny popis = nepoužiteľný výsledok; radšej celá šablóna než pol na pol.
    if (!metaDescription.trim()) return null

    return {
      engine: 'ai',
      metaDescription: clampDescription(metaDescription),
      metaTitle: normalizeAiTitle(metaTitle, input.title),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verejné API: meta pre jeden produkt.
 *
 * AI beží v pretekoch s tvrdým časovačom a každá chyba padá do šablóny, takže
 * volajúci (beforeChange hook, admin tlačidlo, PDP) dostane výsledok vždy.
 */
export const generateProductMeta = async (input: SeoProductInput): Promise<GeneratedMeta> => {
  const fallback = buildTemplateMeta(input)

  try {
    const ai = await Promise.race([
      generateWithClaude(input),
      new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), AI_TIMEOUT_MS + 500)
        // `unref` existuje len v Node; v edge/browser runtime sa preskočí.
        if (typeof (timer as unknown as { unref?: () => void })?.unref === 'function') {
          ;(timer as unknown as { unref: () => void }).unref()
        }
      }),
    ])

    if (ai?.metaDescription && ai?.metaTitle) return ai
  } catch {
    // padá do šablóny
  }

  return fallback
}
