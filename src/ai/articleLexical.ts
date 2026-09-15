/**
 * Lexical strom článku z vygenerovaných sekcií (Z15).
 *
 * `posts.content` je lexical pole s plnou sadou funkcií (nadpisy, bloky,
 * odkazy). Generátor z neho používa len dve najjednoduchšie stavebné kocky —
 * odsek a nadpis `h2` — lebo presne to je tvar, ktorý má článok mať, a všetko
 * ostatné (obrázky, bannery, výzvy k akcii) si majiteľka doplní v editore.
 *
 * Tvar uzlov je odpísaný z dokumentu, ktorý uložil samotný editor (vrátane
 * `version`, `format`, `indent`, `direction`, `textFormat`, `textStyle`).
 * To nie je zdvorilosť voči schéme: Payload aj lexical si na chýbajúcich
 * kľúčoch dopĺňajú defaulty nekonzistentne a taký dokument potom v admine
 * hodí chybu pri načítaní. Odsek má navyše `textFormat`/`textStyle`, nadpis
 * ich nemá — presne ako v uložených článkoch.
 *
 * Sesterský súbor `src/scraper/lexical.ts` robí to isté pre importované
 * produkty (len odseky). Zámerne sa nezdieľajú: scraper vlastní iný agent a
 * jeho kontrakt je užší — spoločný súbor by len zviazal dve nezávislé cesty.
 */
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type { ArticleSection } from './articleWriter'

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

type HeadingNode = {
  children: TextNode[]
  direction: null | string
  format: string
  indent: number
  tag: 'h2'
  type: 'heading'
  version: number
}

const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()

const textNode = (text: string): TextNode => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

export const paragraphNode = (text: string): ParagraphNode => ({
  children: [textNode(text)],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

export const headingNode = (text: string): HeadingNode => ({
  children: [textNode(text)],
  direction: null,
  format: '',
  indent: 0,
  tag: 'h2',
  type: 'heading',
  version: 1,
})

/**
 * Sekcie → lexical stav.
 *
 * Poradie je presne také, ako ho vráti model: úvodné odseky bez nadpisu,
 * potom pre každú ďalšiu sekciu `h2` a jej odseky. Prázdne reťazce sa
 * vyhadzujú — prázdny odsek v editore vyzerá ako omylom stlačený enter.
 *
 * Vracia `null`, keď po očistení nezostal ani jeden odsek; volajúci to má
 * brať ako zlyhanie generovania, nie ako prázdny článok (`posts.content` je
 * povinné pole).
 */
export const sectionsToLexical = (sections: ArticleSection[]): null | SerializedEditorState => {
  const children: (HeadingNode | ParagraphNode)[] = []

  for (const section of sections ?? []) {
    const heading = squash(section?.heading ?? '')
    const paragraphs = (section?.paragraphs ?? [])
      .map((paragraph) => squash(typeof paragraph === 'string' ? paragraph : ''))
      .filter(Boolean)

    // Nadpis bez textu pod sebou nemá čo nadpisovať.
    if (!paragraphs.length) continue

    if (heading) children.push(headingNode(heading))

    for (const paragraph of paragraphs) children.push(paragraphNode(paragraph))
  }

  if (!children.length) return null

  return {
    root: {
      type: 'root',
      children,
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  } as unknown as SerializedEditorState
}
