import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import { OrderItem } from '@/components/OrderItem'
import { PackageSearch } from 'lucide-react'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

export default async function Orders() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k objednávkam.')}`)
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch (error) {}

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[32px] sm:text-[38px]">Objednávky</h1>
      </div>

      <div className="w-full rounded-default border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <h2 className="mb-6 font-sans text-xl font-black uppercase tracking-wide text-black">
          História objednávok
        </h2>

        {(!orders || !Array.isArray(orders) || orders?.length === 0) && (
          <div className="flex flex-col items-center gap-3 rounded-default border border-gray-100 bg-gray-50 px-8 py-16 text-center">
            <PackageSearch className="size-8 text-gray-300" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Zatiaľ nemáte žiadne objednávky.</p>
          </div>
        )}

        {orders && orders.length > 0 && (
          <ul className="flex flex-col gap-4">
            {orders?.map((order, index) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Vaše objednávky v ZAPLETANE e-shope.',
  openGraph: mergeOpenGraph({
    title: 'Objednávky',
    url: '/orders',
  }),
  title: 'Objednávky',
}
