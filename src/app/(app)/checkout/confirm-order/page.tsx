import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React, { Fragment } from 'react'
import { ConfirmOrder } from '@/components/checkout/ConfirmOrder'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ConfirmOrderPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: SearchParams
}) {
  const searchParams = await searchParamsPromise

  const paymentIntent = searchParams.paymentId

  return (
    <div className="flex min-h-[70vh] items-center bg-gray-50">
      <div className="container-page flex py-16">
        <ConfirmOrder />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Potvrdzujeme vašu objednávku.',
  openGraph: mergeOpenGraph({
    title: 'Potvrdzujeme objednávku',
    url: '/checkout/confirm-order',
  }),
  title: 'Potvrdzujeme objednávku',
}
