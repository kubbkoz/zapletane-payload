import type { CollectionAfterChangeHook } from 'payload'

import type { Order, OrderStatus } from '@/payload-types'

import { sendPushToCustomer } from './send'

/**
 * Slovak copy for each order state, matching the pills the customer already
 * sees in /orders (src/components/OrderStatus). Kept in sync by hand rather
 * than imported: that module is a React client component, and pulling it into
 * a server hook would drag JSX into the Payload config bundle.
 */
const STATUS_LABELS: Record<NonNullable<OrderStatus>, string> = {
  cancelled: 'Zrušená',
  completed: 'Doručená',
  processing: 'Spracováva sa',
  refunded: 'Vrátená',
}

/** Relationship fields arrive either as an id or as a populated doc, depending on `depth`. */
function relationshipId(value: Order['customer']): null | number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id
  return null
}

/**
 * Human-facing order reference.
 *
 * There is no order-number field on the collection today, so this is the row
 * id — the same number /orders/[id] shows. Written as a lookup rather than
 * `doc.id` so that adding an `orderNumber` field later starts being used here
 * without another edit.
 */
function orderReference(order: Order): string {
  const numbered = (order as { orderNumber?: number | string }).orderNumber

  if (typeof numbered === 'string' && numbered.trim()) return numbered.trim()
  if (typeof numbered === 'number') return String(numbered)

  return String(order.id)
}

/**
 * Push the customer when the *status* of their order changes.
 *
 * Wired into the orders collection via `ordersCollectionOverride` in
 * src/plugins/index.ts (see that file's `orders` key).
 *
 * Three deliberate silences:
 *   - creates never notify (nobody wants „Objednávka prijatá — Spracováva sa"
 *     a second after the confirmation page says exactly that),
 *   - an update that leaves `status` untouched never notifies, so editing an
 *     address or attaching a transaction is silent,
 *   - a guest order (no `customer` relationship) never notifies, because a
 *     push subscription is tied to an account; e-mail remains their channel.
 *
 * Fire-and-forget: the promise is intentionally not awaited. A push service
 * round-trip must not sit inside the order-update request, and a push service
 * being down must never fail the write that triggered it — so the hook returns
 * synchronously and every outcome is logged, never thrown.
 */
export const notifyOrderStatusChange: CollectionAfterChangeHook = ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== 'update') return doc

  const order = doc as Order
  const previous = previousDoc as Order | undefined

  if (!order.status || previous?.status === order.status) return doc

  const customerId = relationshipId(order.customer)

  if (customerId === null) return doc

  const reference = orderReference(order)

  void sendPushToCustomer(req.payload, customerId, {
    body: `Stav sa zmenil: ${STATUS_LABELS[order.status]}`,
    tag: `order-${order.id}`,
    title: `Objednávka č. ${reference}`,
    url: `/orders/${order.id}`,
  }).catch((error) => {
    console.error('[push] order-status notification failed for order', order.id, error)
  })

  return doc
}
