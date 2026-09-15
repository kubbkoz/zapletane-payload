import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/utilities/cn'

type Props = {
  children?: ReactNode
  className?: string
  icon: LucideIcon
  text: string
}

/** Shared "nothing here yet" panel — one recipe for orders, addresses and slots. */
export const AccountEmptyState: React.FC<Props> = ({ children, className, icon: Icon, text }) => (
  <div
    className={cn(
      'flex flex-col items-center gap-3 rounded-default border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center sm:px-8',
      className,
    )}
  >
    <Icon className="size-8 text-gray-300" strokeWidth={1.5} />
    <p className="font-sans text-sm text-gray-500">{text}</p>
    {children}
  </div>
)
