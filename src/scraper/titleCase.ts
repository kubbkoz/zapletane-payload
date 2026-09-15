/**
 * Prirodzená veľkosť písmen v názvoch produktov (Z14).
 *
 * Zdrojový e-shop (wiklinowa-wies.pl a väčšina Shoper obchodov) píše názvy
 * KAPITÁLKAMI: „FOTEL WIKLINOWY REGAN". Na našom webe to kričí — majiteľka
 * chce „Prútené kreslo Regan".
 *
 * Opravu robia DVE nezávislé vrstvy:
 *
 *   1. **Prekladač** dostane v prompte príkaz vracať názvy v prirodzenej
 *      slovenskej vetnej podobe (`translate.ts`). To je tá kvalitná vrstva —
 *      model vie, že „Regan" je meno modelu a „wiklinowy" je prídavné meno.
 *   2. **Tento modul** beží VŽDY, aj keď preklad zlyhá alebo je zdroj už po
 *      slovensky. Je čisto mechanický: keď je názov prevažne veľkými písmenami,
 *      zhodí ho na malé a prvé písmeno zdvihne.
 *
 * Mechanická vrstva sama o sebe nevie, že „REGAN" je meno. Preto si pred
 * prevodom vyzbiera *nápovedy* z textov, ktoré kapitálkami písané NIE SÚ —
 * z popisu produktu (`properNounHints`). Slovo, ktoré sa v popise vyskytuje s
 * veľkým začiatočným písmenom uprostred vety, je takmer isto vlastné meno a
 * veľké písmeno si v názve ponechá.
 *
 * Čo sa nikdy nezhadzuje: tokeny s číslicou (rozmery, kódy) a krátky zoznam
 * veľkostí/skratiek (`KEEP_UPPER`). Slová v úvodzovkách („Regan") ostávajú s
 * veľkým začiatočným písmenom aj bez nápovedy — v tomto katalógu sú v
 * úvodzovkách práve názvy modelov a kolekcií.
 */

/** Od akého podielu veľkých písmen sa text považuje za „kričaný". */
export const UPPERCASE_RATIO_THRESHOLD = 0.7

/** Kratší text než toto sa neposudzuje — na štatistiku je príliš krátky. */
const MIN_LETTERS_FOR_RATIO = 4

/**
 * Skratky a veľkostné značky, ktoré veľké písmená držia vždy.
 *
 * Zámerne krátky a ručný zoznam: čokoľvek automatické (napr. „každý token do
 * troch písmen") by zhodilo aj spojky a predložky, ktoré v slovenčine práve
 * také krátke sú („A", „NA", „SO").
 */
const KEEP_UPPER = new Set([
  '2D',
  '3D',
  'CZK',
  'DIY',
  'EAN',
  'EUR',
  'LED',
  'PLN',
  'PVC',
  'SKU',
  'USB',
  'UV',
  'XL',
  'XS',
  'XXL',
  'XXXL',
])

/** Úvodzovky, ktoré otvárajú citát (slovenské, poľské, nemecké, anglické). */
const OPENING_QUOTES = new Set(['„', '«', '‚', '“', '‘', '"', "'", '‟', '‛'])

/** Úvodzovky, ktoré citát zatvárajú. */
const CLOSING_QUOTES = new Set(['”', '“', '»', '’', '"', "'"])

/** Interpunkcia, po ktorej začína nová veta — ďalšie slovo ide s veľkým. */
const SENTENCE_END = /[.!?…]$/

const isLetter = (char: string): boolean => /\p{L}/u.test(char)

/** Podiel veľkých písmen zo VŠETKÝCH písmen textu (0 – 1). */
export const uppercaseRatio = (text: string): number => {
  let letters = 0
  let upper = 0

  for (const char of text) {
    if (!isLetter(char)) continue

    letters++

    // Písmená bez rozlíšenia veľkosti (číslice, CJK) sa ako veľké nepočítajú.
    if (char === char.toUpperCase() && char !== char.toLowerCase()) upper++
  }

  return letters ? upper / letters : 0
}

/** Je text písaný kapitálkami (a je dosť dlhý na to, aby to niečo znamenalo)? */
export const isShouted = (text: string): boolean => {
  const letters = [...text].filter(isLetter).length

  return letters >= MIN_LETTERS_FOR_RATIO && uppercaseRatio(text) >= UPPERCASE_RATIO_THRESHOLD
}

/** Orezanie interpunkcie z okrajov tokenu — vráti „holé" slovo. */
const bareWord = (token: string): string =>
  token.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '')

/**
 * Vlastné mená vyzbierané z bežne písaných textov.
 *
 * Kľúč je slovo malými písmenami, hodnota je tvar, v akom sa v texte našlo.
 * Berú sa len slová s veľkým začiatočným písmenom, ktoré NIE sú na začiatku
 * vety — tam totiž veľké písmeno nič nehovorí.
 */
export const properNounHints = (texts: Array<null | string | undefined>): Map<string, string> => {
  const hints = new Map<string, string>()

  for (const text of texts) {
    // Kričaný text nedáva žiadnu informáciu — tam je veľké písmeno všade.
    if (!text || isShouted(text)) continue

    const tokens = text.split(/\s+/)
    let previous = ''

    for (const [index, token] of tokens.entries()) {
      const startsSentence = index === 0 || SENTENCE_END.test(previous)

      previous = token

      if (startsSentence) continue

      const word = bareWord(token)

      // Dvojpísmenové slová sú v slovenčine aj poľštine skoro vždy predložky.
      if (word.length < 3) continue

      const first = word[0]!

      if (first !== first.toUpperCase() || first === first.toLowerCase()) continue

      // „WIKLINOWY" uprostred vety je zvyšok kričania, nie meno.
      if (uppercaseRatio(word) >= UPPERCASE_RATIO_THRESHOLD) continue

      hints.set(word.toLowerCase(), word)
    }
  }

  return hints
}

/** Prvé písmeno veľké, zvyšok malými — pre jeden token. */
const capitalizeWord = (token: string): string => {
  const lower = token.toLowerCase()
  const index = [...lower].findIndex(isLetter)

  if (index === -1) return lower

  const chars = [...lower]

  chars[index] = chars[index]!.toUpperCase()

  return chars.join('')
}

/** Prvé písmeno celého názvu veľké; zvyšok sa nedotýka. */
const capitalizeFirstLetter = (text: string): string => {
  const chars = [...text]
  const index = chars.findIndex(isLetter)

  if (index === -1) return text

  chars[index] = chars[index]!.toUpperCase()

  return chars.join('')
}

/**
 * Názov produktu v prirodzenej vetnej podobe.
 *
 * Keď názov kapitálkami písaný NIE JE, vráti sa nezmenený (len sa zjednotia
 * medzery) — prekladač už odviedol svoju prácu a prepisovať ju by bolo horšie
 * než nechať tak.
 */
export const normalizeTitle = (
  raw: null | string | undefined,
  hints?: Map<string, string> | null,
): string => {
  const title = (raw ?? '').replace(/\s+/g, ' ').trim()

  if (!title || !isShouted(title)) return title

  const tokens = title.split(' ')
  const out: string[] = []
  let quoted = false
  let previous = ''

  for (const [index, token] of tokens.entries()) {
    const word = bareWord(token)
    const startsSentence = index === 0 || SENTENCE_END.test(previous)
    const opensQuote = !quoted && OPENING_QUOTES.has(token[0] ?? '')

    previous = token

    if (opensQuote) quoted = true

    const closesQuote = quoted && CLOSING_QUOTES.has(token[token.length - 1] ?? '')

    // 1) čísla, rozmery a kódy ostávajú presne tak, ako prišli
    if (/\d/.test(token) || KEEP_UPPER.has(word.toUpperCase())) {
      out.push(token)
    } else if (hints?.has(word.toLowerCase())) {
      // 2) slovo, ktoré popis píše s veľkým začiatočným písmenom → vlastné meno
      out.push(token.replace(word, hints.get(word.toLowerCase())!))
    } else if (quoted || startsSentence) {
      // 3) v úvodzovkách (názov modelu) a po bodke → veľké začiatočné písmeno
      out.push(capitalizeWord(token))
    } else {
      out.push(token.toLowerCase())
    }

    if (closesQuote) quoted = false
  }

  return capitalizeFirstLetter(out.join(' '))
}
