import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon, RotateCcw } from 'lucide-react'
import { ProductItem } from '@/components/ProductItem'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { OrderStatus } from '@/components/OrderStatus'
import { AddressItem } from '@/components/addresses/AddressItem'
import { OrderPaymentInstructions } from '@/components/checkout/OrderPaymentInstructions'
import { formatEurocents } from '@/payments/shared/rules'

export const dynamic = 'force-dynamic'

/** Slovak labels for the `paymentType` options on the orders override (src/plugins/index.ts). */
const paymentTypeLabels: Record<string, string> = {
  bankTransfer: 'Bankový prevod',
  card: 'Platba kartou',
  cod: 'Dobierka',
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string; accessToken?: string }>
}

export default async function Order({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '', accessToken = '' } = await searchParams

  let order: Order | null = null

  try {
    const {
      docs: [orderResult],
    } = await payload.find({
      collection: 'orders',
      user,
      overrideAccess: !Boolean(user),
      depth: 2,
      where: {
        and: [
          {
            id: {
              equals: id,
            },
          },
          ...(user
            ? [
                {
                  customer: {
                    equals: user.id,
                  },
                },
              ]
            : [
                {
                  accessToken: {
                    equals: accessToken,
                  },
                },
                ...(email
                  ? [
                      {
                        customerEmail: {
                          equals: email,
                        },
                      },
                    ]
                  : []),
              ]),
        ],
      },
      select: {
        amount: true,
        currency: true,
        items: true,
        customerEmail: true,
        customer: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        shippingAddress: true,
        // W1 — doprava a platba: the fee breakdown behind `amount`, plus the
        // payment type that decides which instructions the shopper gets.
        shippingMethod: true,
        paymentType: true,
        shippingFee: true,
        codFee: true,
        // X1 — zľavový kód uplatnený v pokladni.
        discountCode: true,
        discountAmount: true,
      },
    })

    const canAccessAsGuest =
      !user &&
      email &&
      accessToken &&
      orderResult &&
      orderResult.customerEmail &&
      orderResult.customerEmail === email
    const canAccessAsUser =
      user &&
      orderResult &&
      orderResult.customer &&
      (typeof orderResult.customer === 'object'
        ? orderResult.customer.id
        : orderResult.customer) === user.id

    if (orderResult && (canAccessAsGuest || canAccessAsUser)) {
      order = orderResult
    }
  } catch (error) {
    console.error(error)
  }

  if (!order) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {user ? (
          <Button
            asChild
            variant="ghost"
            className="gap-2 px-0 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-brand"
          >
            <Link href="/orders">
              <ChevronLeftIcon className="size-4" />
              Všetky objednávky
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="rounded-default bg-brand-100 px-3 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.15em] text-brand">
            {`Objednávka #${order.id}`}
          </h1>
          {order.status && <OrderStatus status={order.status} />}
        </div>
      </div>

      <div className="mb-6">
        <OrderPaymentInstructions order={order} />
      </div>

      <div className="flex flex-col gap-10 rounded-default border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 border-b border-gray-100 pb-8 sm:flex-row sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Dátum objednávky
            </p>
            <p className="font-sans text-lg font-bold text-black">
              <time dateTime={order.createdAt}>
                {/* Numeric: date-fns formats month names in English by default. */}
                {formatDateTime({ date: order.createdAt, format: 'd. M. yyyy' })}
              </time>
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Celková suma
            </p>
            {order.amount != null && (
              <Price
                className="font-sans text-lg font-black text-black"
                amount={order.amount}
                currencyCode={order.currency ?? undefined}
              />
            )}
          </div>

          {order.paymentType && (
            <div className="sm:max-w-[40%]">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Spôsob platby
              </p>
              <p className="font-sans text-lg font-bold text-black">
                {paymentTypeLabels[order.paymentType] ?? order.paymentType}
              </p>
            </div>
          )}
        </div>

        {order.items && order.items.length > 0 && (
          <div>
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Položky objednávky
            </h2>
            <ul className="flex flex-col gap-6">
              {order.items?.map((item, index) => {
                if (typeof item.product === 'string') {
                  return null
                }

                if (!item.product || typeof item.product !== 'object') {
                  return (
                    <div key={index} className="text-sm text-gray-500">
                      Táto položka už nie je dostupná.
                    </div>
                  )
                }

                const variant =
                  item.variant && typeof item.variant === 'object' ? item.variant : undefined

                return (
                  <li key={item.id}>
                    <ProductItem
                      product={item.product}
                      quantity={item.quantity}
                      variant={variant}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {(order.shippingFee || order.codFee || order.shippingMethod || order.discountAmount) && (
          <div className="border-t border-gray-100 pt-8">
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Doprava a platba
            </h2>

            <div className="flex flex-col gap-2">
              {Boolean(order.discountAmount) && (
                <div className="flex items-center justify-between gap-4">
                  <span className="font-sans text-[13px] text-gray-600">
                    {order.discountCode ? `Zľava — ${order.discountCode}` : 'Zľava'}
                  </span>
                  <span className="font-sans text-sm font-bold text-success">
                    {`- ${formatEurocents(order.discountAmount ?? 0)}`}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="font-sans text-[13px] text-gray-600">
                  {typeof order.shippingMethod === 'object' && order.shippingMethod
                    ? `Doprava — ${order.shippingMethod.title}`
                    : 'Doprava'}
                </span>
                <Price
                  amount={order.shippingFee ?? 0}
                  as="span"
                  currencyCode={order.currency ?? undefined}
                  className="font-sans text-sm font-bold text-black"
                />
              </div>

              {Boolean(order.codFee) && (
                <div className="flex items-center justify-between gap-4">
                  <span className="font-sans text-[13px] text-gray-600">
                    {order.paymentType === 'cod' ? 'Dobierka' : 'Poplatok za platbu'}
                  </span>
                  <Price
                    amount={order.codFee ?? 0}
                    as="span"
                    currencyCode={order.currency ?? undefined}
                    className="font-sans text-sm font-bold text-black"
                  />
                </div>
              )}

              {order.amount != null && (
                <div className="mt-2 flex items-center justify-between gap-4 border-t border-gray-100 pt-3">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    Spolu
                  </span>
                  <Price
                    amount={order.amount}
                    as="span"
                    currencyCode={order.currency ?? undefined}
                    className="font-sans text-base font-black text-black"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {order.shippingAddress && (
          <div className="border-t border-gray-100 pt-8">
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Doručovacia adresa
            </h2>

            {/* @ts-expect-error - some kind of type hell */}
            <AddressItem address={order.shippingAddress} hideActions />
          </div>
        )}
      </div>

      {/* Z2 — the reklamácia entry point, with the order number prefilled into
          the returns page (and from there into the mailto subject). */}
      <div className="mt-6 flex flex-col gap-4 rounded-default border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div className="min-w-0">
          <h2 className="font-sans text-base font-black uppercase tracking-wide text-black">
            Reklamácia / vrátenie tovaru
          </h2>
          <p className="mt-1 font-sans text-[13px] leading-snug text-gray-600">
            Tovar môžete vrátiť do 14 dní od prevzatia. Pozrite si postup krok za krokom.
          </p>
        </div>

        <Link
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-default border border-gray-200 px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:border-brand hover:text-brand"
          href={`/account/returns?order=${order.id}`}
        >
          <RotateCcw className="size-3.5" />
          Ako postupovať
        </Link>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return {
    description: `Detail objednávky #${id}.`,
    openGraph: mergeOpenGraph({
      title: `Objednávka #${id}`,
      url: `/orders/${id}`,
    }),
    title: `Objednávka #${id}`,
  }
}
