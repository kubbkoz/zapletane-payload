import { OrderStatus } from '@/components/OrderStatus'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Order } from '@/payload-types'
import { formatDateTime } from '@/utilities/formatDateTime'
import { Package } from 'lucide-react'
import Link from 'next/link'

type Props = {
  order: Order
}

/** "1 položka" / "2–4 položky" / "5+ položiek" — Slovak plural rules. */
function itemsCountLabel(count: number): string {
  if (count === 1) return '1 položka'
  if (count >= 2 && count <= 4) return `${count} položky`
  return `${count} položiek`
}

export const OrderItem: React.FC<Props> = ({ order }) => {
  return (
    <div className="flex flex-col gap-6 rounded-default border border-gray-100 bg-gray-50/50 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent">
          <Package className="size-5" />
        </span>

        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-lg font-black leading-none text-black">{`#${order.id}`}</h3>

          <div className="flex flex-wrap items-center gap-3">
            <time
              dateTime={order.createdAt}
              className="font-sans text-xs font-medium text-gray-600"
            >
              {/* Numeric: date-fns formats month names in English by default. */}
              {formatDateTime({ date: order.createdAt, format: 'd. M. yyyy' })}
            </time>
            {order.status && <OrderStatus status={order.status} />}
          </div>

          <p className="flex items-center gap-2 text-xs text-gray-500">
            <span>{itemsCountLabel(order.items?.length ?? 0)}</span>
            {order.amount != null && (
              <>
                <span aria-hidden>•</span>
                <Price
                  as="span"
                  className="font-bold text-black"
                  amount={order.amount}
                  currencyCode={order.currency ?? undefined}
                />
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        asChild
        className="self-start rounded-default border-gray-200 text-[11px] font-bold uppercase tracking-widest hover:border-brand hover:text-brand sm:self-auto"
      >
        <Link href={`/orders/${order.id}`}>Zobraziť objednávku</Link>
      </Button>
    </div>
  )
}
