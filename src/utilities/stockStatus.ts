/**
 * ZAPLETANE stock-status semantics (design.md §16/§17, DESIGN-SPEC §1.1).
 *
 * Three states, always rendered with the same token set so the card, the PDP
 * and the cart line item read identically:
 *   - inStock  → success green, "breathe" pulse, label "Skladom"
 *   - onOrder  → accent (brown, never orange), pulse, label "Na objednávku"
 *   - soldOut  → gray, opacity-60 + diagonal strike-through, label "Vypredané"
 *
 * Priority rule carried over verbatim from the Vue original: available stock
 * always wins; the closeout/sold-out branch only matters once stock is 0. The
 * Payload port has no `isCloseout` flag — a product that does not track
 * inventory at all (`inventory === null`) is the port's "on order" case.
 */
export type StockState = 'inStock' | 'onOrder' | 'soldOut'

export const stockLabel: Record<StockState, string> = {
  inStock: 'Skladom',
  onOrder: 'Na objednávku',
  soldOut: 'Vypredané',
}

/** Chip border/background + pulse glow, matching ProductCard.vue's stock pill. */
export const stockChipClass: Record<StockState, string> = {
  inStock: 'border-success bg-white stock-pulse-green',
  onOrder: 'border-accent-400 bg-white stock-pulse-accent',
  soldOut: 'border-gray-200 bg-gray-50 opacity-60',
}

/** Small inline dot used on cart line items and the PDP info rows. */
export const stockDotClass: Record<StockState, string> = {
  inStock: 'bg-success',
  onOrder: 'bg-accent-400',
  soldOut: 'bg-error',
}

export const stockTextClass: Record<StockState, string> = {
  inStock: 'text-success',
  onOrder: 'text-brand',
  soldOut: 'text-gray-500',
}

export function getStockState(inventory?: number | null): StockState {
  if (typeof inventory !== 'number') return 'onOrder'
  return inventory > 0 ? 'inStock' : 'soldOut'
}

/** "Posledné 3 ks" — shown next to the pill when stock runs low. */
export function lowStockNote(inventory?: number | null): string | null {
  if (typeof inventory !== 'number') return null
  if (inventory <= 0 || inventory >= 10) return null
  return `Posledné ${inventory} ks`
}
