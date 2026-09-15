'use client'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { ShoppingCart } from 'lucide-react'
import React from 'react'

import { Price } from '@/components/Price'
import { cn } from '@/utilities/cn'

/**
 * Navbar cart affordance (DESIGN-SPEC §2.1 NavIcons): a bare `ShoppingCart`
 * glyph in espresso ink that warms to brand brown — no dark pill chip — with the
 * count in the shared accent badge (`-top-2 -right-2`, white hairline ring) that
 * the wishlist and compare icons use too.
 *
 * On a quantity increase the icon plays `animate-cart-pop` once (scale 1→1.18→1
 * on cubic-bezier(0.22,1,0.36,1)) — deliberately NOT `animate-bounce`, which
 * design.md §9 bans outright.
 *
 * Z10 changed two things:
 *
 *   - the label is the **cart sum**, not the word "Košík". It is formatted by
 *     the shared `<Price>` component (`useCurrency().formatCurrency`, locale
 *     `sk-SK`), so the navbar, the drawer subtotal and the PDP price can never
 *     drift apart. An empty cart shows `0,00 €` rather than collapsing to the
 *     bare icon — the bar keeps a constant width, so adding the first item does
 *     not shove the whole icon cluster sideways.
 *   - the `.navLink` class is gone. That class drew a 2px bar under the trigger
 *     on hover (`&::after` in Header/index.css) — an underline in all but name.
 *     Hover feedback here is now colour only, black → brand brown.
 *
 * The subtotal is read from `useCart()` right here rather than threaded in as a
 * prop: `CartModal` (which renders this as its `SheetTrigger`) is out of Z10's
 * scope, and the hook is already mounted in this exact subtree.
 */
export function OpenCartButton({
  className,
  quantity,
  ...rest
}: React.ComponentProps<'button'> & {
  className?: string
  quantity?: number
}) {
  const { cart } = useCart()
  const [popping, setPopping] = React.useState(false)
  const previous = React.useRef<number>(quantity ?? 0)

  React.useEffect(() => {
    const next = quantity ?? 0
    if (next > previous.current) {
      setPopping(true)
      const timer = setTimeout(() => setPopping(false), 500)
      previous.current = next
      return () => clearTimeout(timer)
    }
    previous.current = next
  }, [quantity])

  const subtotal = typeof cart?.subtotal === 'number' ? cart.subtotal : 0

  return (
    <button
      aria-label={quantity ? `Nákupný košík — ${quantity} položiek` : 'Nákupný košík'}
      className={cn(
        'group relative inline-flex items-center gap-2 bg-transparent text-black no-underline transition-colors duration-200 hover:cursor-pointer hover:text-brand',
        className,
      )}
      type="button"
      {...rest}
    >
      <span
        className={cn(
          'relative flex items-center justify-center',
          popping && 'animate-cart-pop',
        )}
      >
        <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
        {quantity ? (
          <span className="absolute -right-2.5 -top-2.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-[3px] text-[9px] font-bold leading-none text-white ring-2 ring-brand-50">
            {quantity > 99 ? '99+' : quantity}
          </span>
        ) : null}
      </span>

      <Price
        amount={subtotal}
        as="span"
        className="hidden font-tech text-[12px] font-bold leading-none tracking-wide tabular-nums xl:inline"
      />
    </button>
  )
}
