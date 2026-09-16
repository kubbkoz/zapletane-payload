import { cn } from '@/utilities/cn'

type Props = {
  /** `null`/`undefined` = this product/variant does not track inventory. */
  inventory?: null | number
}

/** Below this many pieces the bar switches to the attention tone. */
const LOW_STOCK_THRESHOLD = 5

/**
 * Visual "full" reference for the availability bar. Purely a display scale
 * (not a real ceiling) — 20+ ks reads as a full brand-filled bar, fewer
 * pieces proportionally drain it down to the low-stock zone.
 */
const BAR_FULL_REFERENCE = 20

/**
 * PDP stock counter (Z18 owner spec) — replaces the old badge-style pill on
 * the product page only (the `/shop` card keeps its existing badge). No
 * hooks, no `'use client'`: it is a pure function of `inventory`, so it stays
 * server-renderable and the caller (which already knows the selected
 * variant) is the only thing that needs to be a Client Component.
 *
 * Three states, same semantics as `utilities/stockStatus.ts`:
 *   - untracked (`inventory` not a number)      → „Na objednávku“, no bar
 *   - tracked, 0                                 → „Vypredané“, empty gray bar
 *   - tracked, > 0                                → „Skladom: N ks“ + brand bar,
 *     switching to the attention tone under `LOW_STOCK_THRESHOLD` with a
 *     „Posledné kusy!“ note.
 */
export function StockCounter({ inventory }: Props) {
  const tracked = typeof inventory === 'number'

  if (!tracked) {
    return (
      <div className="inline-flex h-7 items-center gap-2 rounded-sm bg-brand-100 px-3">
        <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
        <span className="whitespace-nowrap font-sans text-[12px] font-semibold leading-none text-brand-800">
          Na objednávku
        </span>
      </div>
    )
  }

  const soldOut = inventory <= 0
  const low = !soldOut && inventory < LOW_STOCK_THRESHOLD
  const fillPercent = soldOut ? 0 : Math.min(100, Math.round((inventory / BAR_FULL_REFERENCE) * 100))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {soldOut ? (
          <span className="font-sans text-sm font-semibold text-gray-500">Vypredané</span>
        ) : (
          <span className="font-sans text-sm text-gray-600">
            Skladom:{' '}
            <span
              className={cn(
                'font-display text-base font-medium',
                low ? 'text-warning' : 'text-black',
              )}
            >
              {inventory} ks
            </span>
          </span>
        )}

        {low && (
          <span className="font-tech text-[11px] font-bold uppercase tracking-widest text-warning">
            Posledné kusy!
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-sm bg-gray-100"
      >
        <div
          className={cn(
            'h-full rounded-sm transition-[width] duration-300 ease-out',
            !soldOut && (low ? 'bg-warning' : 'bg-brand'),
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  )
}
