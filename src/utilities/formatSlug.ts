/**
 * `formatSlug` — jediný prevod „ľudský názov → adresa" v celom projekte.
 *
 * Slovenčina má diakritiku, ktorú v URL nechceme: „Ako pletieme naše deky"
 * musí skončiť ako `ako-pletieme-nase-deky`, nie ako percentami zakódovaná
 * kaša. Preto sa text najprv rozloží na NFD (á = a + ◌́), zahodia sa spájacie
 * znamienka (Unicode blok U+0300–U+036F) a až potom sa všetko, čo nie je
 * písmeno alebo číslica, nahradí pomlčkou.
 *
 * Zvlášť sa riešia len znaky, ktoré NFD nerozloží, lebo to nie sú „písmeno +
 * znamienko", ale samostatné písmená: `đ`, `ð`, `ø`, `ł`, `ß`, `æ`, `œ`.
 * Slovenské `ĺ`, `ŕ`, `ô`, `ž`, `š`, `č`, `ť`, `ď`, `ň`, `ľ`, `ý`, `á`, `é`,
 * `í`, `ú`, `ä` a české `ě`, `ů`, `ř` NFD rozloží samo.
 *
 * Výsledok je vždy bezpečný do URL: malé písmená a-z, číslice a pomlčky,
 * bez pomlčiek na začiatku a na konci, bez zdvojených pomlčiek.
 */

/** Písmená, ktoré NFD nerozloží — nemajú „základ + znamienko". */
const STANDALONE_LETTERS: Record<string, string> = {
  æ: 'ae',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  ø: 'o',
  œ: 'oe',
  ß: 'ss',
  þ: 'th',
}

export const formatSlug = (input: unknown): string => {
  if (typeof input !== 'string') return ''

  return (
    input
      .normalize('NFD')
      // Spájacie diakritické znamienka (◌́ ◌̌ ◌̂ ◌̈ …) — to je to, čo NFD oddelilo.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[æđðłøœßþ]/g, (char) => STANDALONE_LETTERS[char] ?? char)
      // Čokoľvek, čo nie je a-z ani 0-9, je oddeľovač.
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

export default formatSlug
