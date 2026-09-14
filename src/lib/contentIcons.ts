/**
 * Whitelist of lucide icons an editor may pick for a content card.
 *
 * Deliberately a closed list of *names* with no `lucide-react` import: this
 * module is pulled into `payload.config.ts` (the globals build their `select`
 * options from it), and the admin bundle has no business importing the
 * storefront's icon set. `ContentIcon` (src/components/ContentIcon.tsx) owns the
 * name → component mapping, so only these eight icons are ever tree-shaken into
 * the storefront.
 */
export const CONTENT_ICON_NAMES = [
  'Heart',
  'Leaf',
  'Sparkles',
  'Truck',
  'Hand',
  'Package',
  'Star',
  'Shield',
] as const

export type ContentIconName = (typeof CONTENT_ICON_NAMES)[number]

/** `options` for a Payload `select` field. */
export const CONTENT_ICON_OPTIONS = CONTENT_ICON_NAMES.map((name) => ({
  label: name,
  value: name,
}))

export function isContentIconName(value: unknown): value is ContentIconName {
  return typeof value === 'string' && (CONTENT_ICON_NAMES as readonly string[]).includes(value)
}
