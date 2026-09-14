import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon } from 'lucide-react'
import { ProductItem } from '@/components/ProductItem'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { OrderStatus } from '@/components/OrderStatus'
import { AddressItem } from '@/components/addresses/AddressItem'
import { OrderPaymentInstructions } from '@/components/checkout/OrderPaymentInstructions'

export const dynamic = 'force-dynamic'

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

        <h1 className="rounded-default bg-brand-100 px-3 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.15em] text-brand">
          {`Objednávka #${order.id}`}
        </h1>
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
                {formatDateTime({ date: order.createdAt, format: 'MMMM dd, yyyy' })}
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

          {order.status && (
            <div className="sm:max-w-[33%]">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Stav
              </p>
              <OrderStatus status={order.status} />
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

        {(order.shippingFee || order.codFee || order.shippingMethod) && (
          <div className="border-t border-gray-100 pt-8">
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Doprava a platba
            </h2>

            <div className="flex flex-col gap-2">
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
