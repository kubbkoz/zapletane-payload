import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import { AlertCircle } from 'lucide-react'

import { CheckoutPage } from '@/components/checkout/CheckoutPage'

/**
 * Checkout page shell (DESIGN-SPEC §3.5): quiet `bg-gray-50` body band with the
 * standard page container and generous vertical rhythm — the conversion flow
 * itself lives in <CheckoutPage />.
 */
export default function Checkout() {
  return (
    <div className="min-h-[70vh] bg-gray-50">
      <div className="container-page py-8 md:py-12">
        <h1 className="sr-only">Pokladňa</h1>

        {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
          <div className="flex items-start gap-3 rounded-default border border-error/30 bg-error-light p-4 font-sans text-sm text-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              {'Platobná brána nie je nakonfigurovaná — doplňte Stripe API kľúče. Pozrite '}
              <a
                className="underline underline-offset-4"
                href="https://dashboard.stripe.com/test/apikeys"
                rel="noopener noreferrer"
                target="_blank"
              >
                Stripe dashboard
              </a>
              {' a '}
              <a
                className="underline underline-offset-4"
                href="https://github.com/payloadcms/payload/blob/3.x/templates/ecommerce/README.md#stripe"
                rel="noopener noreferrer"
                target="_blank"
              >
                README
              </a>
              {'.'}
            </div>
          </div>
        )}

        <CheckoutPage />
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
