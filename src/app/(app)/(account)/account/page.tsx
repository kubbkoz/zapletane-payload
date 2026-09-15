import type { Metadata } from 'next'

import { AccountCard } from '@/components/account/AccountCard'
import { AccountEmptyState } from '@/components/account/AccountEmptyState'
import { AddressPreview } from '@/components/account/AddressPreview'
import { OrderSummaryRow } from '@/components/account/OrderSummaryRow'
import { getAccountAddresses, getAccountOrders } from '@/components/account/queries'
import { addressForKind, addressKinds } from '@/components/addresses/slots'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { Heart, LogOut, MapPin, PackageSearch, RotateCcw, ShoppingBag, UserRound } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k nastaveniam účtu.')}`,
    )
  }

  const [addresses, orders] = await Promise.all([
    getAccountAddresses(user),
    getAccountOrders({ limit: 3, user }),
  ])

  // Z10 — how many products this customer has hearted. Read straight off the
  // user document (ids only, no population): the hub only needs a number, and
  // `payload.auth` does not guarantee the relationship is loaded.
  const wishlistCount = await (async () => {
    if (user.collection !== 'users') return 0

    try {
      const doc = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
        overrideAccess: false,
        select: { wishlist: true },
        user,
      })

      return Array.isArray(doc?.wishlist) ? doc.wishlist.length : 0
    } catch {
      return 0
    }
  })()

  // `user` is a union of every auth-enabled collection (the MCP plugin adds its
  // own API-key collection, which has no email), so both fields are narrowed.
  const displayName = 'name' in user && user.name ? user.name : undefined
  const email = 'email' in user && user.email ? user.email : undefined

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[28px] sm:text-[38px]">Prehľad účtu</h1>
        <p className="mt-3 font-sans text-sm font-medium text-gray-600">
          Vitajte späť
          {displayName || email ? (
            <>
              , <span className="font-bold text-black">{displayName ?? email}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AccountCard
          cta="Upraviť údaje a heslo"
          description="Meno, e-mail a prihlasovacie heslo."
          href="/account/settings"
          icon={UserRound}
          title="Moje údaje"
        >
          <dl className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Meno
              </dt>
              <dd className="font-sans text-sm font-bold text-black">
                {displayName ?? <span className="font-medium text-gray-400">Nevyplnené</span>}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
                E-mail
              </dt>
              <dd className="break-all font-sans text-sm font-bold text-black">{email ?? '—'}</dd>
            </div>
          </dl>
        </AccountCard>

        <AccountCard
          cta="Spravovať adresy"
          description="Fakturačná a dodacia adresa pre rýchlejšiu pokladňu."
          href="/account/addresses"
          icon={MapPin}
          title="Adresy"
        >
          <div className="flex flex-col gap-3">
            {addressKinds.map((kind) => (
              <AddressPreview address={addressForKind(addresses, kind)} key={kind} kind={kind} />
            ))}
          </div>
        </AccountCard>
      </div>

      {/* Z10 — Obľúbené, medzi Adresami a Objednávkami. */}
      <AccountCard
        cta="Zobraziť obľúbené"
        description="Kúsky, ktoré ste si uložili srdiečkom."
        href="/wishlist"
        icon={Heart}
        title="Obľúbené"
      >
        {wishlistCount === 0 ? (
          <AccountEmptyState icon={Heart} text="Zatiaľ nemáte uložený žiadny produkt.">
            <Link
              className="mt-1 inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:text-brand"
              href="/shop"
            >
              <ShoppingBag className="size-3.5" />
              Prejsť do obchodu
            </Link>
          </AccountEmptyState>
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3">
            <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Uložené kúsky
            </span>
            <span className="font-tech text-lg font-bold leading-none text-black">
              {wishlistCount}
            </span>
          </div>
        )}
      </AccountCard>

      <AccountCard
        cta={orders.length > 0 ? 'Všetky objednávky' : undefined}
        description="Posledné objednávky a ich stav."
        href={orders.length > 0 ? '/orders' : undefined}
        icon={PackageSearch}
        title="Objednávky"
      >
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
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <OrderSummaryRow order={order} />
              </li>
            ))}
          </ul>
        )}
      </AccountCard>

      <AccountCard
        cta="Ako postupovať"
        description="Máte 14 dní na odstúpenie od zmluvy. Pozrite si postup pri reklamácii alebo vrátení tovaru."
        href="/account/returns"
        icon={RotateCcw}
        title="Reklamácia / vrátenie tovaru"
      />

      <div className="flex justify-start">
        <Link
          className="inline-flex items-center gap-2 rounded-default border border-gray-200 bg-white px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-600 transition-colors hover:border-brand hover:text-brand"
          href="/logout"
        >
          <LogOut className="size-4" />
          Odhlásiť sa
        </Link>
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Prehľad vášho zákazníckeho účtu v ZAPLETANE e-shope.',
  openGraph: mergeOpenGraph({
    title: 'Môj účet',
    url: '/account',
  }),
  title: 'Môj účet',
}
