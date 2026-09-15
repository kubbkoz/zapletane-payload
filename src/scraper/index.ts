/**
 * Verejné rozhranie scrapera (Z12).
 *
 * Všetko pod `src/scraper/` je server-only: moduly siahajú na sieť, na
 * `process.env.ANTHROPIC_API_KEY` a na Payload Local API. Importuj ich len
 * z API rout, hookov a skriptov — nikdy z klientskeho komponentu.
 */
export { discover, shoperPageUrl, type DiscoverResult } from './discover'
export {
  absoluteUrl,
  extractProduct,
  externalIdFromUrl,
  htmlToParagraphs,
  imageCandidates,
  MAX_IMAGES,
  parsePriceNumber,
} from './extract'
export { fetchBuffer, fetchPage, politeDelay, POLITE_DELAY_MS, tryFetchPage } from './fetchPage'
export { findImportedProduct, importProduct, toPreview, type ImportOutcome } from './importProduct'
export { detectLanguage, normalizeLangCode } from './language'
export { textToLexical } from './lexical'
export {
  convertPrice,
  DEFAULT_FALLBACK_RATE,
  formatEurocents,
  roundUpTo99,
  type PriceConversion,
} from './price'
export { scrapeAndPrepare, type ScrapeResult } from './pipeline'
export { translateBatch, TRANSLATION_CHUNK_SIZE } from './translate'
export type {
  PreparedProduct,
  ProductPreview,
  ScrapedAttribute,
  ScrapedProduct,
  ScraperJobSettings,
  TranslatedProduct,
} from './types'
