import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import { stripeAdapterClient } from '@payloadcms/plugin-ecommerce/payments/stripe'
import React from 'react'

import { comgateAdapterClient } from '@/payments/comgate/client'
import { manualAdapterClient } from '@/payments/manual/client'

// Mirror of the plugin's EUR currency constant (src/plugins/index.ts). Inlined
// rather than imported from '@payloadcms/plugin-ecommerce' — that is the server
// entry and must not be pulled into the client bundle.
const EUR = { code: 'EUR', decimals: 2, label: 'Euro', symbol: '€' }

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            enableVariants={true}
            currenciesConfig={{
              defaultCurrency: 'EUR',
              supportedCurrencies: [EUR],
            }}
            api={{
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    gallery: true,
                    inventory: true,
                  },
                  variants: {
                    title: true,
                    inventory: true,
                  },
                },
              },
            }}
            paymentMethods={[
              // Offline (dobierka / bankový prevod) and Comgate card payments.
              // These are descriptors only — every decision is server-side.
              manualAdapterClient(),
              comgateAdapterClient(),
              stripeAdapterClient({
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
              }),
            ]}
          >
            {children}
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
