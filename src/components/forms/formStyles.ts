/**
 * Shared Tailwind utility recipes for the ZAPLETANE form system.
 *
 * The shadcn primitives in `src/components/ui/` (Input, Label, Select…) are
 * read-only for this pass, so instead of editing them we recreate the
 * `form-input` / `form-input-with-icon` / `form-label` component classes
 * (globals.css §1.4, ported from `uno.config.ts`) as inline utility strings
 * and pass them through each primitive's `className` prop. `cn()` in every
 * primitive resolves conflicts with `tailwind-merge`, so every utility here
 * is a real, registered Tailwind class (theme tokens like `rounded-default`,
 * `bg-gray-50`, `border-brand` — never an arbitrary/custom one) so it
 * reliably overrides the shadcn default for the same CSS property.
 */

/** Text input / textarea recipe — mirrors `.form-input`. */
export const inputClassName =
  'h-auto w-full rounded-default border border-transparent bg-gray-50 px-4 py-3 text-sm font-medium font-sans shadow-none outline-none transition-all duration-300 gpu-boost focus-visible:border-brand focus-visible:bg-white focus-visible:ring-0'

/** Same as `inputClassName` but with left padding cleared for a leading icon — mirrors `.form-input-with-icon`. */
export const inputWithIconClassName =
  'h-auto w-full rounded-default border border-transparent bg-gray-50 py-3 pl-12 pr-4 text-sm font-medium font-sans shadow-none outline-none transition-all duration-300 gpu-boost focus-visible:border-brand focus-visible:bg-white focus-visible:ring-0'

/** Field label — mirrors `.form-label` (spacing comes from the FormItem gap, not a margin, to avoid doubling up). */
export const labelClassName =
  'block gap-0 text-[10px] font-bold font-sans uppercase tracking-widest text-gray-500'

/** shadcn Select trigger, restyled to match the text-input recipe above. */
export const selectTriggerClassName =
  'h-auto w-full items-center rounded-default border border-transparent bg-gray-50 px-4 py-3 text-sm font-medium font-sans shadow-none gap-2 focus-visible:border-brand focus-visible:bg-white focus-visible:ring-0 data-[placeholder]:text-gray-400'

/** Wraps an icon-prefixed input: `<div className={inputIconWrapClassName}>`. */
export const inputIconWrapClassName = 'relative'

/** Leading icon inside an icon-prefixed input (pair with `inputWithIconClassName`). */
export const inputIconClassName =
  'pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'

/** Uppercase, tracked-out primary submit button — layered on the shadcn Button (`variant="default"`). */
export const primarySubmitClassName =
  'h-12 w-full rounded-default text-[13px] font-bold uppercase tracking-widest gpu-boost'

/** Error / status banner body — mirrors the `bg-error-light border-error/20 text-error` pattern used across every auth form. */
export const errorBannerClassName =
  'flex items-start gap-3 rounded-default border border-error/20 bg-error-light p-4 text-sm text-error'

export const successBannerClassName =
  'flex items-start gap-3 rounded-default border border-success/30 bg-success-light p-4 text-sm text-success'
