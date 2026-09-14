import * as React from 'react'

import { cn } from '@/utilities/cn'

/**
 * Text input. Defaults match the ZAPLETANE `form-input` recipe (DESIGN-SPEC
 * §1.4) rather than shadcn's stock field: a cream fill with a transparent
 * hairline that turns brand-brown while the fill goes white on focus, 3px
 * corners, DM Sans medium. Consumers only need to pass layout classes.
 *
 * (Left as a primitive-level change on purpose — the utility classes shadcn
 * ships here sit in Tailwind's utilities layer and would otherwise win over the
 * `.form-input` component class every time it was applied from the outside.)
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-default border border-transparent bg-gray-50 px-4 py-3 font-sans text-sm font-medium text-black outline-none transition-all duration-300',
        'file:text-foreground placeholder:text-gray-400 selection:bg-brand selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus:border-brand focus:bg-white focus-visible:border-brand focus-visible:bg-white',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-error aria-invalid:bg-error-light',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
