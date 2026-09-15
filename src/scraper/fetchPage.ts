/**
 * Sieťová vrstva scrapera (Z12).
 *
 * Jediné miesto, kde sa siaha von na cudzí server. Robí štyri veci a nič viac:
 *
 *   1. **Timeout** — `AbortController`, 10 s. Cudzí e-shop nesmie zablokovať
 *      serverless funkciu až do jej vlastného limitu.
 *   2. **Opakovanie** — jeden pokus navyše pri sieťovej chybe alebo 5xx.
 *      Viac nie: import beží v dávkach, takže neúspešný produkt sa jednoducho
 *      preskočí a majiteľka ho vidí v počítadle „chyby".
 *   3. **Hlavička prehliadača** — bez rozumného `User-Agent` vracia veľa
 *      e-shopov (aj Shoper) 403 alebo ochudobnené HTML.
 *   4. **Proxy v sandboxe** — v tomto vývojovom prostredí ide všetok odchádzajúci
 *      HTTPS cez lokálnu agent-proxy (`HTTPS_PROXY`) s vlastnou CA
 *      (`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`). Node `fetch` premennú
 *      `HTTPS_PROXY` sám nečíta, takže sa jej musí podsunúť `undici`
 *      `ProxyAgent` ako dispatcher. V produkcii (Vercel) premenná nastavená nie
 *      je a vetva sa nikdy nespustí — beží obyčajný `fetch`.
 *
 * Zdvorilosť (rozostupy medzi požiadavkami) rieši volajúci cez `politeDelay`,
 * nie táto funkcia — inak by sa nedali paralelizovať požiadavky na *rôzne*
 * servery a spomaľoval by sa aj náš vlastný Payload.
 */

const TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 2

/**
 * Bežný desktopový Chrome. Zámerne nie „ZapletaneBot": cieľom je vyzerať ako
 * návštevník, lebo väčšina slovenských/poľských e-shopov nemá `robots.txt`
 * pravidlo pre vlastného bota a neznámy UA jednoducho blokuje.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const DEFAULT_HEADERS: Record<string, string> = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'pl,en;q=0.8,sk;q=0.6',
  'user-agent': USER_AGENT,
}

/** Predvolená pauza medzi dvomi požiadavkami na ten istý cudzí server. */
export const POLITE_DELAY_MS = 1_000

export const politeDelay = (ms: number = POLITE_DELAY_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Dispatcher cez `HTTPS_PROXY`, vytvorený raz a držaný v module.
 *
 * `undici` je tranzitívna závislosť Payloadu aj Node samotného, takže sa
 * importuje dynamicky — keby v nejakom runtime chýbal, proxy vetva sa ticho
 * preskočí a `fetch` to skúsi priamo, namiesto toho aby modul nešiel načítať.
 */
let proxyDispatcherPromise: null | Promise<unknown> = null

const getProxyDispatcher = async (): Promise<unknown> => {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy

  if (!proxyUrl) return undefined

  if (!proxyDispatcherPromise) {
    proxyDispatcherPromise = (async () => {
      try {
        const { ProxyAgent } = await import('undici')

        return new ProxyAgent(proxyUrl)
      } catch {
        return undefined
      }
    })()
  }

  return proxyDispatcherPromise
}

export type FetchResult = {
  contentType: string
  finalUrl: string
  status: number
}

export type FetchPageResult = FetchResult & { html: string }
export type FetchBufferResult = FetchResult & { buffer: Buffer }

class HttpError extends Error {
  status: number

  constructor(status: number, url: string) {
    super(`HTTP ${status} pri ${url}`)
    this.name = 'HttpError'
    this.status = status
  }
}

const isRetryable = (error: unknown): boolean =>
  !(error instanceof HttpError) || error.status >= 500 || error.status === 429

/** Jeden pokus. Vracia surovú `Response`; volajúci si vyberie text/buffer. */
const attempt = async (url: string, headers: Record<string, string>): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const dispatcher = await getProxyDispatcher()

    const response = await fetch(url, {
      cache: 'no-store',
      // `redirect: 'follow'` je default, uvedené kvôli čitateľnosti: Shoper
      // presmerováva `/p/<názov>/<id>` na kanonický tvar názvu a bez
      // nasledovania presmerovania by import videl prázdne telo.
      redirect: 'follow',
      headers,
      signal: controller.signal,
      // `dispatcher` nie je v štandardnom `RequestInit`, undici ho číta navyše.
      ...(dispatcher ? ({ dispatcher } as Record<string, unknown>) : {}),
    })

    if (!response.ok) throw new HttpError(response.status, url)

    return response
  } finally {
    clearTimeout(timer)
  }
}

const withRetry = async (url: string, headers: Record<string, string>): Promise<Response> => {
  let lastError: unknown

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      return await attempt(url, headers)
    } catch (error) {
      lastError = error

      if (i < MAX_ATTEMPTS - 1 && isRetryable(error)) {
        await politeDelay(500)
        continue
      }

      break
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/** Stiahne HTML stránku. Hodí výnimku pri HTTP chybe aj po opakovaní. */
export const fetchPage = async (url: string): Promise<FetchPageResult> => {
  const response = await withRetry(url, DEFAULT_HEADERS)

  return {
    contentType: response.headers.get('content-type') || '',
    finalUrl: response.url || url,
    html: await response.text(),
    status: response.status,
  }
}

/** Stiahne binárny súbor (obrázok) ako buffer — rovnaká politika ako `fetchPage`. */
export const fetchBuffer = async (url: string): Promise<FetchBufferResult> => {
  const response = await withRetry(url, {
    ...DEFAULT_HEADERS,
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  })

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || '',
    finalUrl: response.url || url,
    status: response.status,
  }
}

/** `fetchPage`, ktorý pri chybe vráti `null` namiesto výnimky. */
export const tryFetchPage = async (url: string): Promise<FetchPageResult | null> => {
  try {
    return await fetchPage(url)
  } catch {
    return null
  }
}
