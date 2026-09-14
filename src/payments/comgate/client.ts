import type { PaymentAdapterClient, PaymentAdapterClientArgs } from '@payloadcms/plugin-ecommerce/types'

import { COMGATE_PAYMENT_NAME } from '@/payments/comgate/constants'

/**
 * Browser-side descriptor for the Comgate adapter. All logic is server-side
 * (src/payments/comgate/index.ts) — this only registers the method name with
 * `EcommerceProvider` so `initiatePayment('comgate', …)` resolves.
 */
export const comgateAdapterClient = (
  props: PaymentAdapterClientArgs = {},
): PaymentAdapterClient => ({
  name: COMGATE_PAYMENT_NAME,
  confirmOrder: true,
  initiatePayment: true,
  label: props.label || 'Platba kartou',
})
