import { XIcon } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/cn'

/**
 * Off-canvas close chip — "Aero Standard" (design.md §18): 40×40 on a faint ink
 * wash, near-square corners, never a bordered neutral square.
 */
export function CloseCart({ className }: { className?: string }) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-default bg-gray-900/5 text-gray-500 transition-colors hover:bg-gray-900/10 hover:text-black">
      <XIcon className={cn('h-5 w-5', className)} />
    </div>
  )
}
