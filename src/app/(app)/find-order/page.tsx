import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import { FindOrderForm } from '@/components/forms/FindOrderForm'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'

export default async function FindOrderPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="bg-brand-50 py-16 md:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-md rounded-default border border-gray-100 bg-white p-8 shadow-panel md:p-10">
          <FindOrderForm initialEmail={user && 'email' in user ? user.email : undefined} />
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Nájdite svoju objednávku pomocou emailu a čísla objednávky.',
  openGraph: mergeOpenGraph({
    title: 'Nájsť objednávku',
    url: '/find-order',
  }),
  title: 'Nájsť objednávku',
}
