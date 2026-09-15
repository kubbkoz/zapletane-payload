/**
 * Minimálny lexical richtext z obyčajných odsekov (Z12).
 *
 * `products.description` je lexical pole. Import má na vstupe len zoznam
 * preložených odsekov, takže sa z nich skladá najjednoduchší platný strom:
 * `root > paragraph > text`. Tvar je odpísaný z dokumentu, ktorý uložil samotný
 * editor (vrátane `version`, `format`, `indent`, `direction`, `textFormat`) —
 * Payload aj lexical si na chýbajúcich kľúčoch pýtajú defaulty nekonzistentne
 * a načítanie takého dokumentu v admine potom hodí chybu.
 *
 * Zámerne žiadne nadpisy, zoznamy ani odkazy: zdrojové HTML cudzieho e-shopu
 * býva plné inline štýlov z WYSIWYG editora a prenášať ich by znamenalo
 * importovať aj cudzí dizajn. Majiteľka dostane čistý text, ktorý si vie
 * naformátovať sama.
 */
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

type TextNode = {
  detail: number
  format: number
  mode: string
  style: string
  text: string
  type: 'text'
  version: number
}

type ParagraphNode = {
  children: TextNode[]
  direction: null | string
  format: string
  indent: number
  textFormat: number
  textStyle: string
  type: 'paragraph'
  version: number
}

const textNode = (text: string): TextNode => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const paragraphNode = (text: string): ParagraphNode => ({
  children: [textNode(text)],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

/**
 * Odseky → lexical stav. Prázdny vstup vracia `null`, nie prázdny root:
 * `products.description` nie je povinné a prázdny strom by v admine vyzeral
 * ako „popis existuje, len je prázdny".
 */
export const textToLexical = (paragraphs: string[]): null | SerializedEditorState => {
  const clean = paragraphs.map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean)

  if (!clean.length) return null

  return {
    root: {
      type: 'root',
      children: clean.map(paragraphNode),
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  } as unknown as SerializedEditorState
}
