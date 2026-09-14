/**
 * Adapter name shared by the server adapter, the client adapter and the
 * checkout UI. Also the value stored in `transactions.paymentMethod` and the
 * URL segment of `/api/payments/comgate/*`.
 */
export const COMGATE_PAYMENT_NAME = 'comgate'

/** Browser lands here after leaving the gateway. */
export const COMGATE_RETURN_PATH = '/api/comgate/return'

/** Comgate's server-to-server result push lands here. */
export const COMGATE_STATUS_PATH = '/api/comgate/status'
