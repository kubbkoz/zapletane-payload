'use client'

import { ShoppingCart } from 'lucide-react'
import React from 'react'

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
 */
export function OpenCartButton({
  className,
  quantity,
  ...rest
}: React.ComponentProps<'button'> & {
  className?: string
  quantity?: number
}) {
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

  return (
    <button
      aria-label={quantity ? `Nákupný košík — ${quantity} položiek` : 'Nákupný košík'}
      className={cn(
        'navLink group relative inline-flex items-center gap-2 bg-transparent text-black transition-colors duration-200 hover:cursor-pointer hover:text-brand',
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

      <span className="hidden font-sans text-[11px] font-bold uppercase tracking-widest xl:inline">
        Košík
      </span>
    </button>
  )
}
