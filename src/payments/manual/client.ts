import type { PaymentAdapterClient, PaymentAdapterClientArgs } from '@payloadcms/plugin-ecommerce/types'

import { MANUAL_PAYMENT_NAME } from '@/payments/manual/constants'

/**
 * Browser-side half of the offline adapter — a pure descriptor.
 *
 * `EcommerceProvider` only needs to know the method exists and which of the two
 * endpoints it supports; all the logic runs server-side in
 * src/payments/manual/index.ts (which must never reach the client bundle).
 */
export const manualAdapterClient = (props: PaymentAdapterClientArgs = {}): PaymentAdapterClient => ({
  name: MANUAL_PAYMENT_NAME,
  confirmOrder: true,
  initiatePayment: true,
  label: props.label || 'Dobierka / prevod',
})
