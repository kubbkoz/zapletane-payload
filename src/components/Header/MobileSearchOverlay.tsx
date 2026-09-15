'use client'

import { cn } from '@/utilities/cn'
import { createUrl } from '@/utilities/createUrl'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** `SiteSettings.search.placeholder`, threaded through the same prop flow the
   *  header uses; falls back to the header SearchBar's copy. */
  placeholder?: string
}

const DEFAULT_PLACEHOLDER = 'Hľadať produkt, kategóriu...'

/**
 * Fullscreen mobile search — the search half of the app shell (the header's
 * `SearchBar` is `lg:flex`, so below `md` this overlay and the bottom bar's
 * "Hľadať" tab are the storefront's search entry point).
 *
 * Deliberately built on the `MobileMenu` recipe rather than a new one: same
 * cream `bg-brand-50` full-bleed surface, same portal-to-`document.body` (the
 * `<nav>` above carries `gpu-boost`/`translateZ(0)`, which would otherwise make
 * a `fixed inset-0` child resolve against the navbar instead of the viewport),
 * same "stay mounted, fade + `inert`" open/close so the transition can run both
 * ways, same `--ease-out` token, same 300ms-in / 150ms-out timing.
 *
 * Submitting goes to `/shop?q=` — the one search contract this storefront has.
 */
export function MobileSearchOverlay({ isOpen, onClose, placeholder }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Escape closes, and the body never scrolls behind the overlay.
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Focus after the opening frame so iOS raises the keyboard reliably.
  useEffect(() => {
    if (!isOpen) return

    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  if (!mounted) return null

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const term = value.trim()
    if (!term) return

    const params = new URLSearchParams()
    params.set('q', term)

    onClose()
    setValue('')
    router.push(createUrl('/shop', params))
  }

  return createPortal(
    <div
      aria-hidden={!isOpen}
      aria-label="Vyhľadávanie"
      className={cn(
        'fixed inset-0 z-[130] flex h-[100dvh] w-full flex-col overflow-hidden bg-brand-50 md:hidden',
        'transition-opacity ease-[var(--ease-out)] motion-reduce:transition-none',
        isOpen
          ? 'pointer-events-auto opacity-100 duration-300'
          : 'pointer-events-none opacity-0 duration-150',
      )}
      inert={!isOpen}
      role="dialog"
    >
      {/* Top row — mirrors the mobile menu's: label left, 40×40 close chip right */}
      <div className="flex h-[var(--navbar-height-unscrolled,72px)] w-full shrink-0 items-center justify-between border-b border-gray-200 px-6 pt-safe">
        <span className="font-tech text-xs font-bold uppercase tracking-widest text-gray-500">
          Vyhľadávanie
        </span>

        <button
          aria-label="Zatvoriť vyhľadávanie"
          className="flex h-10 w-10 items-center justify-center rounded-default border border-gray-300 text-black transition-colors duration-200 hover:border-brand hover:text-brand active:scale-95"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="w-full flex-1 overflow-y-auto px-6 pb-safe pt-8">
        <form className="group relative flex w-full" onSubmit={onSubmit} role="search">
          <input
            aria-label="Hľadať produkt"
            autoComplete="off"
            className="w-full rounded-default border border-gray-200 bg-gray-50 py-3.5 pl-5 pr-16 font-sans text-base tracking-wide text-black shadow-[inset_0_1px_3px_rgba(36,25,23,0.08)] transition-all duration-200 placeholder:text-gray-400 focus:border-brand focus:bg-white focus:outline-none"
            enterKeyHint="search"
            name="search"
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder || DEFAULT_PLACEHOLDER}
            ref={inputRef}
            spellCheck={false}
            type="search"
            value={value}
          />

          <button
            aria-label="Hľadať"
            className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-br-default rounded-tr-default bg-accent text-white transition-colors hover:bg-accent-dark"
            type="submit"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        <p className="mt-4 text-[13px] leading-relaxed text-gray-500">
          Napíšte, čo hľadáte — napríklad deku, košík alebo hračku — a potvrďte klávesom Enter.
        </p>
      </div>
    </div>,
    document.body,
  )
}
