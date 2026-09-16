'use client'

import { MinusIcon, PlusIcon } from 'lucide-react'
import React, { useCallback } from 'react'

import { cn } from '@/utilities/cn'

type Props = {
  className?: string
  /** Disables the whole control (sold out, request in flight, …). */
  disabled?: boolean
  /** Upper bound — tracked inventory. `undefined`/`null` = no cap (untracked stock). */
  max?: null | number
  /**
   * Lower bound. PDP usage keeps the default `1` (a not-yet-added item can
   * never go to zero). The cart drawer passes `0` on purpose: decrementing
   * the last unit there removes the line, which is the drawer's original
   * behaviour (see `CartModal.tsx`) and a `min` of `1` would silently break.
   */
  min?: number
  onChange: (next: number) => void
  value: number
}

/**
 * Shared quantity stepper (Z18 owner spec) — the PDP purchase panel and the
 * cart drawer's line items render the exact same markup/classes so the
 * control reads identically everywhere: h-11, rounded-default,
 * border-gray-200, font-tech numerals, brand-hover buttons. It is the cart
 * drawer's original −/qty/+ recipe, generalised into a controlled component
 * with a real `<input type="number">` in the middle instead of a static
 * `<span>`.
 *
 * Purely presentational/controlled: it never talks to the cart itself. Each
 * caller decides what "the value became N" means — the PDP just sets local
 * state, `CartModal` walks `incrementItem`/`decrementItem` (the only
 * primitives the cart hook exposes) the needed number of steps.
 */
export function QuantityStepper({ className, disabled, max, min = 1, onChange, value }: Props) {
  const atMin = value <= min
  const atMax = typeof max === 'number' && value >= max

  const clamp = useCallback(
    (next: number) => {
      let clamped = Number.isFinite(next) ? Math.trunc(next) : min
      clamped = Math.max(min, clamped)
      if (typeof max === 'number') clamped = Math.min(max, clamped)
      return clamped
    },
    [max, min],
  )

  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-default border border-gray-200 bg-white',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        aria-label="Znížiť množstvo"
        className="flex h-11 w-11 flex-none items-center justify-center text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-brand disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300"
        disabled={disabled || atMin}
        onClick={() => onChange(clamp(value - 1))}
        type="button"
      >
        <MinusIcon className="h-4 w-4" />
      </button>

      <input
        aria-label="Množstvo"
        className="w-10 flex-none border-0 bg-transparent text-center font-tech text-sm font-bold text-black outline-none [-moz-appearance:textfield] [appearance:textfield] disabled:text-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        disabled={disabled}
        inputMode="numeric"
        max={typeof max === 'number' ? max : undefined}
        min={min}
        onBlur={(event) => onChange(clamp(Number(event.target.value)))}
        onChange={(event) => {
          const raw = event.target.value
          if (raw === '') return
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) onChange(clamp(parsed))
        }}
        type="number"
        value={value}
      />

      <button
        aria-label="Zvýšiť množstvo"
        className="flex h-11 w-11 flex-none items-center justify-center text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-brand disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300"
        disabled={disabled || atMax}
        onClick={() => onChange(clamp(value + 1))}
        type="button"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
