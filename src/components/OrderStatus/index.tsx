import { OrderStatus as StatusOptions } from '@/payload-types'
import { cn } from '@/utilities/cn'

type Props = {
  status: StatusOptions
  className?: string
}

/** Slovak label + ZAPLETANE status-pill tokens per order state (design.md §component anatomy). */
const statusMeta: Record<
  NonNullable<StatusOptions>,
  { label: string; classes: string }
> = {
  processing: {
    label: 'Spracováva sa',
    classes: 'border-accent-200 bg-accent-50 text-accent-700',
  },
  completed: {
    label: 'Doručená',
    classes: 'border-success/30 bg-success-light text-success',
  },
  cancelled: {
    label: 'Zrušená',
    classes: 'border-error/30 bg-error-light text-error',
  },
  refunded: {
    label: 'Vrátená',
    classes: 'border-gray-200 bg-gray-100 text-gray-600',
  },
}

export const OrderStatus: React.FC<Props> = ({ status, className }) => {
  const meta = status ? statusMeta[status] : undefined

  return (
    <div
      className={cn(
        'w-fit rounded-default border px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-widest',
        meta?.classes ?? 'border-gray-200 bg-gray-100 text-gray-600',
        className,
      )}
    >
      {meta?.label ?? status}
    </div>
  )
}
