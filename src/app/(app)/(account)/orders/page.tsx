import type { Metadata } from 'next'

import { AccountCard } from '@/components/account/AccountCard'
import { AccountEmptyState } from '@/components/account/AccountEmptyState'
import { getAccountOrders } from '@/components/account/queries'
import { OrderItem } from '@/components/OrderItem'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { PackageSearch, RotateCcw, ShoppingBag } from 'lucide-react'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/** „1 objednávka" / „2–4 objednávky" / „5+ objednávok" — Slovak plural rules. */
const ordersCountLabel = (count: number): string => {
  if (count === 1) return '1 objednávka'
  if (count >= 2 && count <= 4) return `${count} objednávky`
  return `${count} objednávok`
}

export default async function Orders() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k objednávkam.')}`)
  }

  const orders = await getAccountOrders({ user })

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[28px] sm:text-[38px]">Objednávky</h1>
        <p className="mt-3 font-sans text-sm font-medium text-gray-600">
          {orders.length > 0
            ? `${ordersCountLabel(orders.length)} vo vašom účte.`
            : 'História vašich objednávok.'}
        </p>
      </div>

      <AccountCard icon={PackageSearch} title="História objednávok">
        {orders.length === 0 ? (
          <AccountEmptyState icon={PackageSearch} text="Zatiaľ nemáte žiadne objednávky.">
            <Link
              className="mt-1 inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:text-brand"
              href="/shop"
            >
              <ShoppingBag className="size-3.5" />
              Prejsť do obchodu
            </Link>
          </AccountEmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}
      </AccountCard>

      <AccountCard
        cta="Ako postupovať"
        description="Tovar môžete vrátiť do 14 dní od prevzatia. Pri reklamácii nám stačí napísať číslo objednávky."
        href="/account/returns"
        icon={RotateCcw}
        title="Reklamácia / vrátenie tovaru"
      />
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
