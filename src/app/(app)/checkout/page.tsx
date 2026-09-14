import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { AlertCircle } from 'lucide-react'

import type { PaymentMethod, ShippingMethod } from '@/payload-types'

import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { isComgateConfigured } from '@/payments/comgate/api'

// The shipping/payment options are shop configuration that an admin can flip at
// any moment, and the cart underneath is per-visitor anyway.
export const dynamic = 'force-dynamic'

const stripeConfigured = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('dummy'),
)

/**
 * Load everything the shopper may choose from at checkout.
 *
 * Card methods are filtered by whether their gateway actually has credentials:
 * an enabled "Platba kartou" row with no COMGATE_MERCHANT/COMGATE_SECRET would
 * otherwise offer a button that can only fail. Dobierka and bankový prevod need
 * no credentials at all and are always offered when enabled.
 */
const getCheckoutMethods = async (): Promise<{
  paymentMethods: PaymentMethod[]
  shippingMethods: ShippingMethod[]
}> => {
  try {
    const payload = await getPayload({ config: configPromise })

    const [shipping, payments] = await Promise.all([
      payload.find({
        collection: 'shipping-methods',
        depth: 0,
        limit: 50,
        sort: 'sortOrder',
        where: { enabled: { equals: true } },
      }),
      payload.find({
        collection: 'payment-methods',
        depth: 0,
        limit: 50,
        sort: 'sortOrder',
        where: { enabled: { equals: true } },
      }),
    ])

    const paymentMethods = payments.docs.filter((method) => {
      if (method.type !== 'card') {
        return true
      }
      return method.gateway === 'stripe' ? stripeConfigured : isComgateConfigured()
    })

    return { paymentMethods, shippingMethods: shipping.docs }
  } catch (error) {
    console.error('[checkout] Could not load shipping/payment methods:', error)
    return { paymentMethods: [], shippingMethods: [] }
  }
}

/**
 * Checkout page shell (DESIGN-SPEC §3.5): quiet `bg-gray-50` body band with the
 * standard page container and generous vertical rhythm — the conversion flow
 * itself lives in <CheckoutPage />.
 */
export default async function Checkout() {
  const { paymentMethods, shippingMethods } = await getCheckoutMethods()

  return (
    <div className="min-h-[70vh] bg-gray-50">
      <div className="container-page py-8 md:py-12">
        <h1 className="sr-only">Pokladňa</h1>

        {(shippingMethods.length === 0 || paymentMethods.length === 0) && (
          <div className="mb-6 flex items-start gap-3 rounded-default border border-error/30 bg-error-light p-4 font-sans text-sm text-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              {shippingMethods.length === 0
                ? 'V administrácii nie je zapnutý žiadny spôsob dopravy (Ecommerce → Spôsoby dopravy).'
                : 'V administrácii nie je zapnutý žiadny dostupný spôsob platby (Ecommerce → Spôsoby platby).'}
            </div>
          </div>
        )}

        <CheckoutPage paymentMethods={paymentMethods} shippingMethods={shippingMethods} />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Bezpečné dokončenie objednávky.',
  openGraph: mergeOpenGraph({
    title: 'Pokladňa',
    url: '/checkout',
  }),
  title: 'Pokladňa',
}
