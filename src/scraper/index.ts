/**
 * Verejné rozhranie scrapera (Z12).
 *
 * Všetko pod `src/scraper/` je server-only: moduly siahajú na sieť, na
 * `process.env.ANTHROPIC_API_KEY` a na Payload Local API. Importuj ich len
 * z API rout, hookov a skriptov — nikdy z klientskeho komponentu.
 */
export {
  discover,
  discoverCategories,
  shoperPageUrl,
  strategyForCategories,
  type DiscoveredCategory,
  type DiscoverResult,
} from './discover'
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
export {
  findExistingProduct,
  findImportedProduct,
  importProduct,
  toPreview,
  type DuplicateMatch,
  type ImportOutcome,
  type SkipReason,
} from './importProduct'
export { detectLanguage, normalizeLangCode } from './language'
export { textToLexical } from './lexical'
export {
  convertPrice,
  DEFAULT_FALLBACK_RATE,
  formatEurocents,
  roundUpTo99,
  type PriceConversion,
} from './price'
export { scrapeAndPrepare, type PreparedFailure, type ScrapeResult } from './pipeline'
export {
  isShouted,
  normalizeTitle,
  properNounHints,
  uppercaseRatio,
  UPPERCASE_RATIO_THRESHOLD,
} from './titleCase'
export {
  timeoutFor,
  translateBatch,
  translateCategoryNames,
  TRANSLATION_CHUNK_SIZE,
  TRANSLATION_MAX_TIMEOUT_MS,
  TRANSLATION_MIN_TIMEOUT_MS,
  type CategoryTranslation,
  type TranslateBatchResult,
  type TranslationFailureCause,
  type TranslationOutcome,
  type TranslationUsage,
} from './translate'
export type {
  CategoryMapEntry,
  PreparedProduct,
  ProductPreview,
  ScrapedAttribute,
  ScrapedProduct,
  ScraperJobSettings,
  TranslatedProduct,
} from './types'
