import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { Order } from '@/payload-types'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import { AddressListing } from '@/components/addresses/AddressListing'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

export default async function AddressesPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k nastaveniam účtu.')}`,
    )
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 5,
      user,
      overrideAccess: false,
      pagination: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch (error) {
    // when deploying this template on Payload Cloud, this page needs to build before the APIs are live
    // so swallow the error here and simply render the page with fallback data where necessary
    // in production you may want to redirect to a 404  page or at least log the error somewhere
    // console.error(error)
  }

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[32px] sm:text-[38px]">Moje adresy</h1>
      </div>

      <div className="rounded-default border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-sans text-xl font-black uppercase tracking-wide text-black">
            Uložené adresy
          </h2>
          <CreateAddressModal />
        </div>

        <AddressListing />
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Spravujte doručovacie a fakturačné adresy vášho účtu.',
  openGraph: mergeOpenGraph({
    title: 'Moje adresy',
    url: '/account/addresses',
  }),
  title: 'Moje adresy',
}
