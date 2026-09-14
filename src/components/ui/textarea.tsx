import * as React from 'react'

import { cn } from '@/utilities/cn'

/** Multi-line field — same `form-input` treatment as <Input />. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content flex min-h-24 w-full rounded-default border border-transparent bg-gray-50 px-4 py-3 font-sans text-sm font-medium text-black outline-none transition-all duration-300',
        'placeholder:text-gray-400 selection:bg-brand selection:text-white',
        'focus:border-brand focus:bg-white focus-visible:border-brand focus-visible:bg-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-error aria-invalid:bg-error-light',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
