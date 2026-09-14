/**
 * Minimal Comgate API v2.0 client.
 *
 * ⚠️  WRITTEN WITHOUT THE VENDOR DOCS. `apidoc.comgate.cz` (and
 * `payments.comgate.cz` itself) are outside this environment's egress
 * allowlist, so every wire-level detail below is reconstructed from knowledge
 * of the v1.0/v2.0 API and flagged with `// TODO-VERIFY(comgate):`. Check each
 * one against the real documentation before switching the card payment method
 * on — until then the seeded "Platba kartou" row stays `enabled: false` and
 * none of this code can be reached from the storefront.
 *
 * Secrets: COMGATE_MERCHANT / COMGATE_SECRET are read from the environment and
 * never logged, never returned to the browser, and never written to a document.
 */

export type ComgateConfig = {
  merchant: string
  secret: string
  test: boolean
}

export type ComgateCreatePaymentArgs = {
  /** Shopper e-mail, forwarded so Comgate can send its own receipt. */
  email?: string
  /** Human-readable product label shown on the gateway + the bank statement. */
  label: string
  /** Total in minor units (eurocents). */
  price: number
  /** Our own reference; see the note in createComgatePayment. */
  refId: string
  /** Absolute URL the shopper's browser returns to. */
  returnURL?: string
}

export type ComgateCreatePaymentResult = {
  redirect: string
  transId: string
}

/** Comgate's terminal states as pushed to the status URL. */
export type ComgatePaymentStatus = 'AUTHORIZED' | 'CANCELLED' | 'PAID' | 'PENDING'

// TODO-VERIFY(comgate): base URL and the `.json` suffix convention of API v2.0.
const COMGATE_API_BASE = 'https://payments.comgate.cz/v2.0'

/**
 * Read the gateway credentials, or `null` when the shop has none configured.
 *
 * Returning `null` rather than throwing is deliberate: the adapter is always
 * registered (so `/api/payments/comgate/*` exists and the config type-checks),
 * but a shop without credentials simply cannot offer the card method.
 */
export const getComgateConfig = (): ComgateConfig | null => {
  const merchant = process.env.COMGATE_MERCHANT
  const secret = process.env.COMGATE_SECRET

  if (!merchant || !secret) {
    return null
  }

  const rawTest = (process.env.COMGATE_TEST ?? 'true').toLowerCase()
  const test = !['0', 'false', 'no', 'off'].includes(rawTest)

  return { merchant, secret, test }
}

export const isComgateConfigured = (): boolean => getComgateConfig() !== null

/**
 * Comgate accepts a JSON body on v2.0 but historically expected
 * `application/x-www-form-urlencoded` with `merchant`/`secret` inline (v1.0),
 * and answers in kind. This parses whichever came back.
 */
const parseComgateResponse = (contentType: string, body: string): Record<string, string> => {
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]),
      )
    } catch {
      // fall through to the urlencoded reader
    }
  }

  // TODO-VERIFY(comgate): v1.0 answered `code=0&message=OK&transId=..&redirect=..`
  // as an URL-encoded string. Kept as a fallback in case v2.0 does the same on
  // some error paths.
  return Object.fromEntries(new URLSearchParams(body).entries())
}

/**
 * Create a payment and get back the URL to send the shopper to.
 *
 * `prepareOnly: true` means "give me a redirect URL, do not try to process
 * anything server-side" — the standard redirect flow.
 */
export const createComgatePayment = async (
  args: ComgateCreatePaymentArgs,
): Promise<ComgateCreatePaymentResult> => {
  const config = getComgateConfig()

  if (!config) {
    throw new Error('Platba kartou nie je nakonfigurovaná (chýba COMGATE_MERCHANT/COMGATE_SECRET).')
  }

  const payload = {
    // TODO-VERIFY(comgate): v2.0 may authenticate purely via HTTP Basic and
    // reject `merchant`/`secret` in the body. Both are sent for now; drop the
    // body copies once the docs confirm Basic auth is sufficient.
    curr: 'EUR',
    email: args.email,
    label: args.label.slice(0, 16),
    merchant: config.merchant,
    // TODO-VERIFY(comgate): `ALL` = let the shopper pick any enabled method on
    // the gateway. Narrow this (e.g. `CARD_ALL`) if the contract is card-only.
    method: 'ALL',
    prepareOnly: true,
    price: args.price,
    refId: args.refId,
    secret: config.secret,
    test: config.test,
    ...(args.returnURL ? { url_paid: args.returnURL } : {}),
  }

  // TODO-VERIFY(comgate): endpoint path (`/payment.json`) and that HTTP Basic
  // carries merchant:secret.
  const response = await fetch(`${COMGATE_API_BASE}/payment.json`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.merchant}:${config.secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const rawBody = await response.text()
  const parsed = parseComgateResponse(response.headers.get('content-type') ?? '', rawBody)

  // TODO-VERIFY(comgate): v1.0 signalled success with `code=0`; v2.0 is
  // expected to use HTTP status codes. Both are treated as authoritative.
  if (!response.ok || (parsed.code && parsed.code !== '0')) {
    throw new Error(
      `Comgate odmietol vytvorenie platby (HTTP ${response.status}${parsed.code ? `, code ${parsed.code}` : ''}).`,
    )
  }

  const transId = parsed.transId || parsed.transID || parsed.id
  const redirect = parsed.redirect || parsed.redirectUrl || parsed.url

  if (!transId || !redirect) {
    throw new Error('Comgate nevrátil identifikátor transakcie ani presmerovanie.')
  }

  return { redirect, transId }
}

/**
 * Pull the authoritative state of a transaction straight from Comgate.
 *
 * Used to double-check the (unauthenticated, network-visible) browser return —
 * the shopper's redirect proves nothing on its own.
 */
export const fetchComgateStatus = async (transId: string): Promise<ComgatePaymentStatus | null> => {
  const config = getComgateConfig()

  if (!config) {
    return null
  }

  try {
    // TODO-VERIFY(comgate): status endpoint shape. v1.0 used
    // `POST /v1.0/status` with merchant/secret/transId; v2.0 is expected to be
    // a REST-ish GET on the transaction resource.
    const response = await fetch(
      `${COMGATE_API_BASE}/payment/transId/${encodeURIComponent(transId)}.json`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${config.merchant}:${config.secret}`).toString('base64')}`,
        },
        method: 'GET',
      },
    )

    const rawBody = await response.text()
    const parsed = parseComgateResponse(response.headers.get('content-type') ?? '', rawBody)

    if (!response.ok) {
      return null
    }

    const status = (parsed.status || '').toUpperCase()

    if (status === 'PAID' || status === 'CANCELLED' || status === 'AUTHORIZED') {
      return status
    }

    return 'PENDING'
  } catch {
    return null
  }
}

/**
 * Constant-time-ish comparison of the `secret` Comgate echoes back on its
 * status push. A plain `===` leaks length/prefix information through timing;
 * this compares every byte.
 */
export const verifyComgateSecret = (candidate: unknown): boolean => {
  const config = getComgateConfig()

  if (!config || typeof candidate !== 'string' || candidate.length !== config.secret.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < config.secret.length; i++) {
    mismatch |= config.secret.charCodeAt(i) ^ candidate.charCodeAt(i)
  }

  return mismatch === 0
}

export const verifyComgateMerchant = (candidate: unknown): boolean => {
  const config = getComgateConfig()
  return Boolean(config) && candidate === config?.merchant
}
