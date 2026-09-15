/**
 * Shared square-chip geometry for the product card's bottom-right action (Z10).
 *
 * The add-to-cart button (simple product) and the "go to the detail" arrow
 * (variable product) are the SAME object visually — brown fill, white glyph,
 * `rounded-default`, colour-only hover — so the card never signals "these do
 * different things" through its styling; only the glyph differs.
 *
 * Kept in its own module, with no `'use client'` banner, precisely so the
 * server-rendered `ProductGridItem` and the client `CardActions` can both
 * import the literal string. Exporting it from the client module instead would
 * hand the server a client *reference* rather than the class name.
 */
export const cardActionClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-default bg-brand text-white transition-colors duration-200 hover:bg-brand-dark'
