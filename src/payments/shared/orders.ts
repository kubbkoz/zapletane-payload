import type { CollectionSlug, Field, PayloadRequest } from 'payload'

import type { Order, Transaction } from '@/payload-types'

/**
 * Shared plumbing for the non-Stripe payment adapters (`manual` and `comgate`).
 *
 * The ecommerce plugin models every checkout as *transaction first, order
 * second*: `initiatePayment` writes a pending transaction holding the cart
 * snapshot, and `confirmOrder` promotes that snapshot into an order. Stripe
 * smuggles the snapshot through PaymentIntent metadata; we have no external
 * provider to hold it for dobierka/prevod, so the snapshot lives on the
 * transaction itself — in the adapter's own group field, built below.
 */

type OrderItems = NonNullable<Order['items']>

type LooseCartItem = {
  product?: unknown
  quantity?: null | number
  variant?: unknown
}

/** Unwrap a relationship value (populated doc, raw id, or nothing) to its id. */
const toDocumentID = (value: unknown): null | number => {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value)
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return toDocumentID((value as { id: unknown }).id)
  }
  return null
}

/** Cart items reduced to plain IDs, exactly like the Stripe adapter does. */
export const flattenCartItems = (cart: { items?: LooseCartItem[] | null }): OrderItems =>
  (cart.items ?? []).flatMap<OrderItems[number]>((item) => {
    const product = toDocumentID(item.product)

    if (product === null || !item.quantity) {
      return []
    }

    const variant = toDocumentID(item.variant)

    return [
      {
        product,
        quantity: item.quantity,
        ...(variant !== null ? { variant } : {}),
      },
    ]
  })

/**
 * Fields every offline/redirect adapter adds to its group on `transactions`.
 *
 * These are the values `confirmOrder` needs but that the plugin's transaction
 * schema has nowhere to put: the resolved delivery/dobierka fees and the
 * shipping address the shopper typed in (there is no `shippingAddress` on a
 * transaction — only `billingAddress`).
 */
export const checkoutCarryFields: Field[] = [
  {
    name: 'paymentType',
    type: 'text',
    admin: { readOnly: true },
    label: 'Typ platby',
  },
  {
    name: 'shippingMethodID',
    type: 'text',
    admin: { readOnly: true },
    label: 'ID spôsobu dopravy',
  },
  {
    name: 'shippingFee',
    type: 'number',
    admin: { readOnly: true },
    label: 'Poplatok za dopravu (v centoch)',
  },
  {
    name: 'codFee',
    type: 'number',
    admin: { readOnly: true },
    label: 'Poplatok za dobierku (v centoch)',
  },
  {
    name: 'shippingAddressSnapshot',
    type: 'json',
    admin: { readOnly: true },
    label: 'Doručovacia adresa (snapshot)',
  },
]

/** Shape written into the adapter group by `initiatePayment`. */
export type CheckoutCarryGroup = {
  codFee?: null | number
  paymentType?: null | string
  shippingAddressSnapshot?: unknown
  shippingFee?: null | number
  shippingMethodID?: null | string
}

/** Read the adapter's carry group off a transaction without `any`. */
export const readCarryGroup = (
  transaction: Transaction,
  groupName: string,
): CheckoutCarryGroup => {
  const value = (transaction as unknown as Record<string, unknown>)[groupName]

  return value && typeof value === 'object' ? (value as CheckoutCarryGroup) : {}
}

/**
 * Promote a pending transaction into a real order.
 *
 * Idempotent: a transaction that already points at an order returns that order
 * untouched, so a double-submit, a retried Comgate callback and a browser
 * refresh all land on the same record instead of duplicating it.
 */
export const createOrderFromTransaction = async ({
  cartsSlug = 'carts',
  decrementInventory = false,
  group,
  orderStatus = 'processing',
  ordersSlug = 'orders',
  productsSlug = 'products',
  req,
  transaction,
  transactionStatus,
  transactionsSlug = 'transactions',
  variantsSlug = 'variants',
}: {
  cartsSlug?: string
  /**
   * Stock is decremented by the plugin's own `confirm-order` endpoint after the
   * adapter returns, so the `manual` adapter must NOT do it again. The Comgate
   * callback creates its order outside that endpoint and therefore must.
   */
  decrementInventory?: boolean
  group: CheckoutCarryGroup
  orderStatus?: Order['status']
  ordersSlug?: string
  productsSlug?: string
  req: PayloadRequest
  transaction: Transaction
  transactionStatus: NonNullable<Transaction['status']>
  transactionsSlug?: string
  variantsSlug?: string
}): Promise<{ created: boolean; order: Order }> => {
  const { payload } = req

  if (transaction.order) {
    const existingID = toDocumentID(transaction.order)

    if (existingID !== null) {
      const existing = (await payload.findByID({
        id: existingID,
        collection: ordersSlug as CollectionSlug,
        depth: 0,
        req,
      })) as Order

      return { created: false, order: existing }
    }
  }

  const customerID = toDocumentID(transaction.customer)
  const shippingMethodID = group.shippingMethodID ? toDocumentID(group.shippingMethodID) : null
  const shippingAddress = group.shippingAddressSnapshot

  const order = (await payload.create({
    collection: ordersSlug as CollectionSlug,
    data: {
      amount: transaction.amount,
      codFee: group.codFee ?? 0,
      currency: transaction.currency,
      ...(customerID !== null ? { customer: customerID } : {}),
      ...(transaction.customerEmail ? { customerEmail: transaction.customerEmail } : {}),
      items: transaction.items,
      paymentType: (group.paymentType ?? undefined) as Order['paymentType'],
      ...(shippingAddress && typeof shippingAddress === 'object'
        ? { shippingAddress: shippingAddress as Order['shippingAddress'] }
        : {}),
      shippingFee: group.shippingFee ?? 0,
      ...(shippingMethodID !== null ? { shippingMethod: shippingMethodID } : {}),
      status: orderStatus,
      transactions: [transaction.id],
    },
    req,
  })) as Order

  // The cart is "used up" once it became an order — the plugin's cart provider
  // starts a fresh one the next time the shopper adds something.
  const cartID = toDocumentID(transaction.cart)

  if (cartID !== null) {
    await payload.update({
      id: cartID,
      collection: cartsSlug as CollectionSlug,
      data: { purchasedAt: new Date().toISOString() },
      req,
    })
  }

  await payload.update({
    id: transaction.id,
    collection: transactionsSlug as CollectionSlug,
    data: {
      order: order.id,
      status: transactionStatus,
    },
    req,
  })

  if (decrementInventory && Array.isArray(transaction.items)) {
    for (const item of transaction.items) {
      const quantity = item.quantity ?? 0

      if (!quantity) {
        continue
      }

      const variantID = toDocumentID(item.variant)
      const productID = toDocumentID(item.product)

      if (variantID !== null) {
        await payload.db.updateOne({
          id: variantID,
          collection: variantsSlug as CollectionSlug,
          data: { inventory: { $inc: quantity * -1 } } as never,
        })
      } else if (productID !== null) {
        await payload.db.updateOne({
          id: productID,
          collection: productsSlug as CollectionSlug,
          data: { inventory: { $inc: quantity * -1 } } as never,
        })
      }
    }
  }

  return { created: true, order }
}
