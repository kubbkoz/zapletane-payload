import type { Address, Order } from '@/payload-types'
import type { TypedUser } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Server-side reads for the account section.
 *
 * Always `user` + `overrideAccess: false`, so the plugin's owner-scoped access
 * (`isDocumentOwner`) is what decides what comes back — the `customer` filter
 * is a second lock, not the only one. Every read swallows its error and
 * returns an empty list: a blinking database must degrade into an empty state,
 * never into a 500 on the customer's own account page.
 */
export const getAccountAddresses = async (user: TypedUser): Promise<Address[]> => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'addresses',
      depth: 0,
      limit: 0,
      overrideAccess: false,
      pagination: false,
      sort: 'createdAt',
      user,
      where: { customer: { equals: user.id } },
    })

    return result?.docs ?? []
  } catch (_error) {
    return []
  }
}

type OrdersArgs = {
  /** `0` = every order (the /orders history). */
  limit?: number
  user: TypedUser
}

export const getAccountOrders = async ({ limit = 0, user }: OrdersArgs): Promise<Order[]> => {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'orders',
      depth: 0,
      limit,
      overrideAccess: false,
      // `pagination: false` makes Payload ignore `limit` — the history wants
      // every order, the hub wants exactly the newest three.
      pagination: limit > 0,
      sort: '-createdAt',
      user,
      where: { customer: { equals: user.id } },
    })

    return result?.docs ?? []
  } catch (_error) {
    return []
  }
}
