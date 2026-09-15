/**
 * Minimal Comgate REST API v2.0 client.
 *
 * verified(comgate-docs): every wire-level detail below (base URL, auth
 * mechanism, request/response field names, status semantics) has been checked
 * against the official Comgate Claude plugin docs (api-overview.md,
 * webhooks.md, states.md, error-codes.md, security-checklist.md,
 * openapi/en_v2.yaml) and confirmed live against `payments.comgate.cz` with
 * intentionally-invalid credentials — see the per-line notes below for what
 * each one confirmed or corrected.
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
  /**
   * Payer's full name. verified(comgate-docs): `fullName` is listed in the
   * `required` array of the `/v2.0/payment.json` request schema (openapi/en_v2.yaml)
   * and in api-overview.md's required-fields table — it was missing from our
   * payload entirely, which this fixes.
   */
  fullName: string
  /** Human-readable product label shown on the gateway + the bank statement. */
  label: string
  /** Total in minor units (eurocents). */
  price: number
  /** Our own reference; see the note in createComgatePayment. */
  refId: string
  /**
   * Absolute URL the shopper's browser returns to. verified(comgate-docs): used
   * for all three outcome redirects (url_paid/url_cancelled/url_pending) — see
   * createComgatePayment — since /api/comgate/return already branches on the
   * real state instead of trusting which URL Comgate picked.
   */
  returnURL?: string
}

export type ComgateCreatePaymentResult = {
  redirect: string
  transId: string
}

/** Comgate's terminal states as pushed to the status URL. */
export type ComgatePaymentStatus = 'AUTHORIZED' | 'CANCELLED' | 'PAID' | 'PENDING'

/** Canonical state of a transaction, as read back from Comgate itself (never from a push body). */
export type ComgateStatusResult = {
  /** ISO 4217 currency Comgate actually processed the payment in. */
  curr: null | string
  /** Amount in minor units Comgate actually processed, for re-validation against our own transaction. */
  price: null | number
  /** Echo of our refId, for cross-checking. */
  refId: null | string
  status: ComgatePaymentStatus
}

// verified(comgate-docs): base URL is `https://payments.comgate.cz` (api-overview.md
// "Base URL"; openapi/en_v2.yaml `servers[0].url`), versioned under `/v2.0`, and every
// endpoint path in the OpenAPI spec literally ends in `.json`
// (`/v2.0/payment.json`, `/v2.0/payment/transId/{transId}.json`, ...). Confirmed live:
// POST /v2.0/payment.json with bad credentials returned a real (non-404) JSON error —
// see the smoke-test note on createComgatePayment.
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
 * Parses a Comgate response body. v2.0 always answers `application/json`
 * (verified below); the `application/x-www-form-urlencoded` reader is kept
 * only as a defensive fallback for the legacy v1.0 shape.
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

  // verified(comgate-docs): the legacy `code=0&message=OK&transId=..&redirect=..`
  // urlencoded reply belongs to the deprecated v1.0 HTTP-POST API. REST v2.0 always
  // answers `application/json` — confirmed both by the create/status response
  // schemas in openapi/en_v2.yaml and live, where an *error* response (HTTP 400,
  // invalid credentials) still came back as JSON, not urlencoded. This branch is
  // dead code for v2.0; kept only as a last-resort fallback so a malformed or
  // unexpected content-type doesn't throw instead of surfacing `parsed.code`.
  return Object.fromEntries(new URLSearchParams(body).entries())
}

/**
 * Create a payment and get back the URL to send the shopper to.
 *
 * verified(comgate-docs): every non-preauth payment already returns a
 * `redirect` URL to the hosted gateway page — that's just how `/v2.0/payment.json`
 * works. There is no `prepareOnly` field anywhere in the v2.0 request schema
 * (openapi/en_v2.yaml properties list), so it was never doing anything and has
 * been removed rather than kept as an untested guess.
 */
export const createComgatePayment = async (
  args: ComgateCreatePaymentArgs,
): Promise<ComgateCreatePaymentResult> => {
  const config = getComgateConfig()

  if (!config) {
    throw new Error('Platba kartou nie je nakonfigurovaná (chýba COMGATE_MERCHANT/COMGATE_SECRET).')
  }

  const payload = {
    // verified(comgate-docs): v2.0 authenticates purely via the `Authorization: Basic`
    // header (openapi `parameters` block on POST /v2.0/payment.json + api-overview.md
    // "Authentication"). `merchant`/`secret` are NOT fields of the JSON body schema at
    // all, so the former body copies were dropped — the header below is sufficient.
    curr: 'EUR',
    email: args.email,
    // verified(comgate-docs): `fullName` is a required field (openapi `required` array
    // + api-overview.md required-fields table) that was missing entirely; now sent.
    fullName: args.fullName,
    label: args.label.slice(0, 16),
    // verified(comgate-docs): `ALL` lets the payer choose any method enabled for this
    // merchant link at the gateway (api-overview.md; openapi `method` description).
    method: 'ALL',
    price: args.price,
    refId: args.refId,
    test: config.test,
    // verified(comgate-docs): the gateway redirects the payer to one of three
    // portal-configured URLs (success/pending/cancelled) unless overridden per-payment
    // via url_paid/url_cancelled/url_pending (openapi request properties). Our
    // /api/comgate/return handler already re-derives the real state itself rather than
    // trusting which outcome URL Comgate happened to use, so all three now point at
    // it — a Portal default (or a blank one) no longer matters.
    ...(args.returnURL
      ? { url_cancelled: args.returnURL, url_paid: args.returnURL, url_pending: args.returnURL }
      : {}),
  }

  // verified(comgate-docs): endpoint path is `/v2.0/payment.json` (POST) and
  // `Authorization: Basic base64(merchant:secret)` is both required and sufficient
  // (openapi `parameters`). Confirmed live against payments.comgate.cz with
  // intentionally-invalid dummy credentials — see the LIVE SMOKE TEST note below.
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

  // verified(comgate-docs): the success response is `code: 0` in a JSON body (the
  // openapi 201 schema and api-overview.md example both key off `code`, not just HTTP
  // status), and non-2xx HTTP is also a failure. Checking both is correct and matches
  // the LIVE SMOKE TEST below, where an auth failure came back as HTTP 400 with
  // `{"code":1400,"message":"Unauthorized access!"}` — response.ok is false AND
  // code !== '0', so both branches of this check are exercised by real traffic.
  //
  // LIVE SMOKE TEST (2026-09-15, sanitized, no real credentials used):
  //   POST https://payments.comgate.cz/v2.0/payment.json
  //   Authorization: Basic base64("invalid-test-merchant:invalid-test-secret")
  //   Content-Type: application/json, body: {price, curr, label, refId, method,
  //     email, fullName, test:true}
  //   -> HTTP/2 400, content-type: application/json; charset=UTF-8
  //   -> {"code":1400,"message":"Unauthorized access!"}
  // Confirms: URL/method/content-type are right (a wrong path 404s at the edge
  // instead of returning a structured Comgate error), the response envelope is
  // `{code, message, ...}` as documented, and an auth failure surfaces as a
  // non-2xx HTTP status carrying a non-zero `code` — exactly what this check expects.
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
 * Used both to double-check the (unauthenticated, network-visible) browser
 * return — the shopper's redirect proves nothing on its own — and, more
 * importantly, as the mandatory defense-in-depth re-check the status push
 * handler runs after the secret matches (webhooks.md "Defense in depth";
 * security-checklist.md). Returns `price`/`curr`/`refId` alongside `status` so
 * the caller can re-validate the amount actually processed against its own
 * transaction record, not just trust the state.
 */
export const fetchComgateStatus = async (transId: string): Promise<ComgateStatusResult | null> => {
  const config = getComgateConfig()

  if (!config) {
    return null
  }

  try {
    // verified(comgate-docs): status endpoint is `GET /v2.0/payment/transId/{transId}.json`
    // with the same `Authorization: Basic` header as create (api-overview.md endpoint
    // cheatsheet; openapi/en_v2.yaml `/v2.0/payment/transId/{transId}.json` `get`). The
    // legacy `POST /v1.0/status` shape does not apply to v2.0.
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

    const rawStatus = (parsed.status || '').toUpperCase()
    const status: ComgatePaymentStatus =
      rawStatus === 'PAID' || rawStatus === 'CANCELLED' || rawStatus === 'AUTHORIZED'
        ? rawStatus
        : 'PENDING'

    return {
      curr: parsed.curr || null,
      price: parsed.price ? Number(parsed.price) : null,
      refId: parsed.refId || null,
      status,
    }
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
