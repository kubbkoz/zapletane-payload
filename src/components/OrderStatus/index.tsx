import { OrderStatus as StatusOptions } from '@/payload-types'
import { cn } from '@/utilities/cn'

type Props = {
  className?: string
  status: StatusOptions
}

/**
 * Slovak label + tinted chip per order state.
 *
 * The four states are exactly the `orders.status` enum generated into
 * payload-types (`processing | completed | cancelled | refunded`) — the plugin
 * has no "shipped" state, so none is invented here. An unknown value still
 * renders (gray chip, raw value) rather than disappearing.
 *
 * Styling follows the stock-badge recipe in `src/utilities/stockStatus.ts`:
 * quiet solid tint + status dot, no outline, so an order status and a stock
 * status read as the same family of signal.
 */
const statusMeta: Record<NonNullable<StatusOptions>, { chip: string; dot: string; label: string }> =
  {
    processing: {
      chip: 'bg-brand-100 text-brand',
      dot: 'bg-brand',
      label: 'Spracováva sa',
    },
    completed: {
      chip: 'bg-success-light text-success',
      dot: 'bg-success',
      label: 'Doručená',
    },
    cancelled: {
      chip: 'bg-error-light text-error',
      dot: 'bg-error',
      label: 'Zrušená',
    },
    refunded: {
      chip: 'bg-gray-100 text-gray-600',
      dot: 'bg-gray-400',
      label: 'Vrátená',
    },
  }

export const OrderStatus: React.FC<Props> = ({ className, status }) => {
  const meta = status ? statusMeta[status] : undefined

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-default px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-widest',
        meta?.chip ?? 'bg-gray-100 text-gray-600',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', meta?.dot ?? 'bg-gray-400')} />
      {meta?.label ?? status}
    </span>
  )
}
