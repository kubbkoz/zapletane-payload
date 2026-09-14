/**
 * Adapter name shared by the server adapter, the client adapter and the
 * checkout UI. It is also the value stored in `transactions.paymentMethod` and
 * the URL segment of `/api/payments/manual/*`, so it must never drift.
 *
 * Kept in its own module because the client bundle may import it, and the
 * adapter itself (src/payments/manual/index.ts) pulls in server-only code.
 */
export const MANUAL_PAYMENT_NAME = 'manual'
