'use client'

import type { SearchSuggestCategory, SearchSuggestProduct } from '@/lib/search'

import { Price } from '@/components/Price'
import { cn } from '@/utilities/cn'
import { createUrl } from '@/utilities/createUrl'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  isOpen: boolean
  /** `SiteSettings.search.minChars` — below it nothing is fetched, exactly as
   * `/shop?q=` ignores a too-short term server-side. */
  minChars?: number
  onClose: () => void
  /** `SiteSettings.search.placeholder`, threaded through the same prop flow the
   *  header uses; falls back to the header SearchBar's copy. */
  placeholder?: string
  /** `SiteSettings.search.recommendedCategories`, resolved server-side. */
  recommendedCategories?: SearchSuggestCategory[]
  /** `SiteSettings.search.recommendedProducts`, resolved server-side. */
  recommendedProducts?: SearchSuggestProduct[]
}

const DEFAULT_PLACEHOLDER = 'Hľadať produkt, kategóriu...'
const DEFAULT_MIN_CHARS = 2
/** Long enough that a fast typist isn't fetched on every keystroke, short
 * enough that the list feels live. */
const DEBOUNCE_MS = 250

/**
 * Fullscreen mobile search — the search half of the app shell (the header's
 * `SearchBar` is `lg:flex`, so below `md` this overlay and the bottom bar's
 * "Hľadať" tab are the storefront's search entry point).
 *
 * Built on the `MobileMenu` recipe: portal-to-`document.body` (the `<nav>`
 * above carries `gpu-boost`/`translateZ(0)`, which would otherwise make a
 * `fixed inset-0` child resolve against the navbar instead of the viewport),
 * "stay mounted, fade + `inert`" open/close so the transition runs both ways,
 * the `--ease-out` token, 300ms-in / 150ms-out.
 *
 * Z1 changes the surface and the body:
 *   - the backdrop is translucent cream + `backdrop-blur-xl`, so the page
 *     stays readable (blurred) behind it — light, never a dark scrim;
 *   - with an empty field the input sits vertically centred (a transitioning
 *     spacer above it, so the shift up is smooth and `motion-reduce` safe);
 *   - typing renders live product rows straight under the input, debounced,
 *     from `/api/search-suggest` — the very query `/shop?q=` runs;
 *   - before typing, the admin's „Odporúčané kategórie" chips and „Odporúčané
 *     produkty" rows take that space (each section only when configured).
 *
 * Submitting — Enter, the submit button, or the "Zobraziť všetky výsledky" row
 * — goes to `/shop?q=`, the one search contract this storefront has.
 */
export function MobileSearchOverlay({
  isOpen,
  minChars,
  onClose,
  placeholder,
  recommendedCategories,
  recommendedProducts,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const [value, setValue] = useState('')
  const [results, setResults] = useState<SearchSuggestProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const categories = recommendedCategories ?? []
  const products = recommendedProducts ?? []
  const threshold = minChars ?? DEFAULT_MIN_CHARS

  const term = value.trim()
  const isSearching = term.length >= threshold

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

  /**
   * Keyboard-up on open. The overlay is always mounted, so opening is a prop
   * flip inside the tab's own event → this effect still runs within that
   * gesture's task, which is what iOS requires to raise the keyboard. Focus
   * is taken synchronously first (the gesture-bound attempt) and repeated on
   * the next frame as the belt-and-braces one for browsers that ignore focus
   * on an element whose `inert` was removed in the same commit.
   */
  useEffect(() => {
    if (!isOpen) return

    inputRef.current?.focus({ preventScroll: true })
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))

    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  // Closing resets the field, so the next open starts from the empty state.
  useEffect(() => {
    if (isOpen) return

    setValue('')
    setResults([])
    setIsLoading(false)
  }, [isOpen])

  // Debounced live results. Below `minChars` nothing is requested at all.
  useEffect(() => {
    if (!isOpen || !isSearching) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      fetch(`/api/search-suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : []))
        .then((data: SearchSuggestProduct[]) => {
          setResults(Array.isArray(data) ? data : [])
          setIsLoading(false)
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === 'AbortError') return
          setResults([])
          setIsLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isOpen, isSearching, term])

  const goToResults = useCallback(
    (query: string) => {
      const params = new URLSearchParams()
      params.set('q', query)

      onClose()
      router.push(createUrl('/shop', params))
    },
    [onClose, router],
  )

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!term) return
    goToResults(term)
  }

  const hasRecommendations = categories.length > 0 || products.length > 0
  /** The input leaves the vertical centre only once there is a live list to
   * make room for — the empty state keeps it centred, recommendations flowing
   * underneath. */
  const isLifted = isSearching

  const spacerStyle = useMemo<React.CSSProperties>(
    () => ({
      // 50dvh puts the field's middle on the screen's middle: minus the header
      // row this spacer starts under, minus half the field's own height. Lifted,
      // it keeps a hairline of breathing room under that header.
      height: isLifted ? '16px' : 'calc(50dvh - 99px)',
    }),
    [isLifted],
  )

  if (!mounted) return null

  return createPortal(
    <div
      aria-hidden={!isOpen}
      aria-label="Vyhľadávanie"
      className={cn(
        // Light, translucent cream + blur: the page stays visible (and
        // readable) behind the overlay — deliberately not a dark scrim.
        'fixed inset-0 z-[130] flex h-[100dvh] w-full flex-col overflow-hidden bg-brand-50/70 backdrop-blur-xl md:hidden',
        'transition-opacity ease-[var(--ease-out)] motion-reduce:transition-none',
        isOpen
          ? 'pointer-events-auto opacity-100 duration-300'
          : 'pointer-events-none opacity-0 duration-150',
      )}
      inert={!isOpen}
      role="dialog"
    >
      {/* Top row — mirrors the mobile menu's: label left, 40×40 close chip right */}
      <div className="flex h-[72px] w-full shrink-0 items-center justify-between border-b border-gray-200/70 px-6 pt-safe">
        <span className="font-tech text-xs font-bold uppercase tracking-widest text-gray-500">
          Vyhľadávanie
        </span>

        <button
          aria-label="Zatvoriť vyhľadávanie"
          className="flex h-10 w-10 items-center justify-center rounded-default border border-gray-300 bg-white/70 text-black transition-colors duration-200 hover:border-brand hover:text-brand active:scale-95"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex w-full flex-1 flex-col overflow-y-auto px-6 pb-safe">
        {/* Centring spacer — collapses (smoothly) when the live list needs the
            room. `prefers-reduced-motion` jumps instead of sliding. */}
        <div
          aria-hidden="true"
          className="shrink-0 transition-[height] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
          style={spacerStyle}
        />

        <form className="group relative flex w-full shrink-0" onSubmit={onSubmit} role="search">
          <input
            aria-label="Hľadať produkt"
            autoComplete="off"
            className="w-full rounded-default border border-gray-200 bg-white/90 py-3.5 pl-5 pr-16 font-sans text-base tracking-wide text-black shadow-[inset_0_1px_3px_rgba(36,25,23,0.08)] transition-all duration-200 placeholder:text-gray-400 focus:border-brand focus:bg-white focus:outline-none"
            enterKeyHint="search"
            name="search"
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder || DEFAULT_PLACEHOLDER}
            ref={inputRef}
            spellCheck={false}
            /* `text`, not `search`: Chrome paints its own off-brand blue clear
               glyph inside a search input. The clear affordance below is the
               header SearchBar's. */
            type="text"
            value={value}
          />

          {value ? (
            <button
              aria-label="Zmazať hľadanie"
              className="absolute right-12 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-gray-400 transition-colors hover:text-gray-700"
              onClick={() => {
                setValue('')
                inputRef.current?.focus({ preventScroll: true })
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <button
            aria-label="Hľadať"
            className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-br-default rounded-tr-default bg-accent text-white transition-colors hover:bg-accent-dark"
            type="submit"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        {isSearching ? (
          /* --- Live results --------------------------------------------- */
          <div className="mt-6 pb-10">
            <SectionLabel>
              Výsledky
              {isLoading ? (
                <Loader2
                  aria-label="Načítavame"
                  className="ml-2 inline h-3 w-3 animate-spin align-[-1px] text-gray-400 motion-reduce:animate-none"
                />
              ) : null}
            </SectionLabel>

            {results.length ? (
              <>
                <ul className="mt-3 flex flex-col">
                  {results.map((product) => (
                    <ProductRow key={product.id} onNavigate={onClose} product={product} />
                  ))}
                </ul>

                <Link
                  className="mt-3 flex items-center justify-between gap-3 rounded-default border border-gray-200 bg-white/70 px-4 py-3 font-tech text-[11px] font-bold uppercase tracking-widest text-brand transition-colors hover:border-brand hover:bg-white"
                  href={`/shop?q=${encodeURIComponent(term)}`}
                  onClick={onClose}
                >
                  Zobraziť všetky výsledky
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : isLoading ? (
              <p className="mt-3 font-sans text-[13px] text-gray-500">Hľadáme…</p>
            ) : (
              <p className="mt-3 font-sans text-[13px] text-gray-600">
                Nič sme nenašli. Skúste iné slovo.
              </p>
            )}
          </div>
        ) : hasRecommendations ? (
          /* --- Empty state: what the admin recommends -------------------- */
          <div className="mt-8 pb-10">
            {categories.length ? (
              <div className="mb-8">
                <SectionLabel>Odporúčané kategórie</SectionLabel>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        className="flex rounded-default border border-gray-200 bg-white/70 px-3.5 py-2 font-sans text-[13px] font-medium text-black transition-colors hover:border-brand hover:text-brand"
                        href={`/shop?category=${category.id}`}
                        onClick={onClose}
                      >
                        {category.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {products.length ? (
              <div>
                <SectionLabel>Odporúčané produkty</SectionLabel>
                <ul className="mt-3 flex flex-col">
                  {products.map((product) => (
                    <ProductRow key={product.id} onNavigate={onClose} product={product} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 shrink-0 pb-10 text-[13px] leading-relaxed text-gray-500">
            Napíšte, čo hľadáte — napríklad deku, košík alebo hračku — a potvrďte klávesom Enter.
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** The storefront's uppercase micro-label, as used above every other list. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-tech text-[11px] font-bold uppercase tracking-widest text-gray-500">
      {children}
    </p>
  )
}

/**
 * One compact result / recommendation row: 48px thumbnail, name, price — the
 * cart cross-sell strip's row, minus its add-to-cart button. Tapping anywhere
 * on it opens the PDP and closes the overlay.
 */
function ProductRow({
  onNavigate,
  product,
}: {
  onNavigate: () => void
  product: SearchSuggestProduct
}) {
  return (
    <li className="border-b border-gray-200/70 last:border-0">
      <Link
        className="flex items-center gap-3 py-2.5"
        href={`/products/${product.slug}`}
        onClick={onNavigate}
      >
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-gray-100 bg-white">
          {product.image?.url ? (
            <Image
              alt={product.image.alt}
              className="h-full w-full object-contain p-1 mix-blend-multiply"
              height={48}
              src={product.image.url}
              width={48}
            />
          ) : null}
        </span>

        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="line-clamp-1 font-sans text-[13px] font-medium leading-snug text-black">
            {product.title}
          </span>
          {typeof product.priceInEUR === 'number' ? (
            <Price
              amount={product.priceInEUR}
              as="span"
              className="font-tech text-[12px] font-bold leading-none text-black"
            />
          ) : null}
        </span>

        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    </li>
  )
}
