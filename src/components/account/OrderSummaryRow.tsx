import type { Order } from '@/payload-types'

import { OrderStatus } from '@/components/OrderStatus'
import { Price } from '@/components/Price'
import { formatDateTime } from '@/utilities/formatDateTime'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Props = {
  order: Order
}

/**
 * Compact one-line order row used on the account hub. The full card (items
 * count, big CTA) lives in `OrderItem` and is used on /orders.
 *
 * Numeric `d. M. yyyy` date on purpose: `formatDateTime` formats with date-fns'
 * default (English) locale, so a textual month would print "September" in an
 * otherwise Slovak UI.
 */
export const OrderSummaryRow: React.FC<Props> = ({ order }) => (
  <Link
    href={`/orders/${order.id}`}
    className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3.5 transition-colors hover:border-brand/40 hover:bg-white"
  >
    <span className="font-sans text-sm font-black text-black">{`#${order.id}`}</span>

    <time dateTime={order.createdAt} className="font-sans text-xs font-medium text-gray-500">
      {formatDateTime({ date: order.createdAt, format: 'd. M. yyyy' })}
    </time>

    {order.status && <OrderStatus status={order.status} />}

    <span className="ml-auto flex items-center gap-2">
      {order.amount != null && (
        <Price
          amount={order.amount}
          as="span"
          className="font-sans text-sm font-bold text-black"
          currencyCode={order.currency ?? undefined}
        />
      )}
      <ChevronRight className="size-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
    </span>
  </Link>
)
