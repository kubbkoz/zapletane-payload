import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { PackageSearch } from 'lucide-react'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { AccountForm } from '@/components/forms/AccountForm'
import { Order } from '@/payload-types'
import { OrderItem } from '@/components/OrderItem'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
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

  // `user` is a union of every auth-enabled collection (the MCP plugin adds its
  // own API-key collection, which has no email), so both branches are narrowed.
  const displayName =
    user && 'name' in user && user.name
      ? user.name
      : user && 'email' in user
        ? user.email
        : undefined

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[32px] sm:text-[38px]">Nastavenia účtu</h1>
        {displayName && (
          <p className="mt-3 font-sans text-sm font-medium text-gray-600">
            Vitajte späť, <span className="font-bold text-black">{displayName}</span>
          </p>
        )}
      </div>

      <div className="rounded-default border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <h2 className="mb-6 font-sans text-xl font-black uppercase tracking-wide text-black">
          Údaje účtu
        </h2>
        <AccountForm />
      </div>

      <div className="rounded-default border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-sans text-xl font-black uppercase tracking-wide text-black">
            Posledné objednávky
          </h2>
        </div>

        {(!orders || !Array.isArray(orders) || orders?.length === 0) && (
          <div className="flex flex-col items-center gap-3 rounded-default border border-gray-100 bg-gray-50 px-8 py-14 text-center">
            <PackageSearch className="size-8 text-gray-300" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Zatiaľ nemáte žiadne objednávky.</p>
          </div>
        )}

        {orders && orders.length > 0 && (
          <ul className="mb-8 flex flex-col gap-4">
            {orders?.map((order, index) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}

        {orders && orders.length > 0 && (
          <Button
            asChild
            variant="outline"
            className="rounded-default border-gray-200 text-[11px] font-bold uppercase tracking-widest hover:border-brand hover:text-brand"
          >
            <Link href="/orders">Zobraziť všetky objednávky</Link>
          </Button>
        )}
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Spravujte svoj zákaznícky účet v ZAPLETANE e-shope.',
  openGraph: mergeOpenGraph({
    title: 'Môj účet',
    url: '/account',
  }),
  title: 'Môj účet',
}
