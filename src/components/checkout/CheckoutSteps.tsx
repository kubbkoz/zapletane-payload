'use client'

import { Check } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/cn'

const STEPS = ['Nákupný košík', 'Kontaktné údaje', 'Doprava a platba'] as const

type Props = {
  /** 1-based index of the step the shopper is on. */
  current: 1 | 2 | 3
  className?: string
}

/**
 * Checkout stepper (DESIGN-SPEC §3.5): three numbered circles —
 * `w-7 h-7 border-2 font-black font-tech text-xs` — joined by a 2px bar that
 * fills brand brown as steps complete, with the number swapped for a `Check`
 * once a step is done.
 */
export const CheckoutSteps: React.FC<Props> = ({ current, className }) => {
  return (
    <ol className={cn('flex items-center', className)}>
      {STEPS.map((label, index) => {
        const step = index + 1
        const isDone = step < current
        const isActive = step === current

        return (
          <li className={cn('flex items-center', index < STEPS.length - 1 && 'flex-1')} key={label}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-tech text-xs font-black',
                  isDone && 'border-brand bg-brand text-white',
                  isActive && 'border-brand bg-white text-brand',
                  !isDone && !isActive && 'border-gray-200 bg-white text-gray-400',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span
                className={cn(
                  'hidden whitespace-nowrap font-sans text-[10px] font-bold uppercase tracking-widest sm:inline',
                  isDone || isActive ? 'text-black' : 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-3 h-[2px] flex-1 transition-colors duration-300',
                  isDone ? 'bg-brand' : 'bg-gray-200',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
