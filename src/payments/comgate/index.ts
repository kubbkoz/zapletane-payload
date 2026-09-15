import type { PaymentAdapter, PaymentAdapterArgs } from '@payloadcms/plugin-ecommerce/types'
import type { CollectionSlug, Field, GroupField } from 'payload'

import type { Order, Transaction } from '@/payload-types'

import { calculateOrderTotal, resolveFees } from '@/payments/shared/fees'
import {
  assertCartIsNotPurchased,
  checkoutCarryFields,
  createOrderFromTransaction,
  flattenCartItems,
  readCarryGroup,
} from '@/payments/shared/orders'
import { createComgatePayment, getComgateConfig } from '@/payments/comgate/api'
import {
  COMGATE_PAYMENT_NAME as GROUP_NAME,
  COMGATE_RETURN_PATH,
} from '@/payments/comgate/constants'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Comgate (platba kartou) adapter — redirect flow.
 *
 *   POST /api/payments/comgate/initiate -> creates a pending transaction, asks
 *        Comgate for a payment and hands the browser a `redirectURL`.
 *   (shopper pays on payments.comgate.cz)
 *   POST /api/comgate/status            -> Comgate's server-to-server push; the
 *        only place a payment is ever accepted as paid, and where the order is
 *        created (see src/app/(app)/api/comgate/status/route.ts).
 *   GET  /api/comgate/return            -> the shopper's browser coming back;
 *        purely cosmetic routing to the right page.
 *
 * `confirmOrder` exists because the adapter contract demands it, but it never
 * *makes* a payment succeed — it only reports the order the status push already
 * created, so a forged browser request cannot conjure a paid order.
 *
 * Every Comgate wire detail has been checked against the official docs; see
 * src/payments/comgate/api.ts and the `verified(comgate-docs)` notes there.
 */

export const comgateAdapter = (props: PaymentAdapterArgs = {}): PaymentAdapter => {
  const { groupOverrides } = props
  const label = props.label || 'Platba kartou (Comgate)'

  const baseFields: Field[] = [
    {
      name: 'transId',
      type: 'text',
      index: true,
      admin: { readOnly: true },
      label: 'Comgate transId',
    },
    {
      name: 'refId',
      type: 'text',
      admin: { readOnly: true },
      label: 'Comgate refId',
    },
    ...checkoutCarryFields,
  ]

  const group: GroupField = {
    name: GROUP_NAME,
    type: 'group',
    ...groupOverrides,
    admin: {
      condition: (data) => data?.paymentMethod === GROUP_NAME,
      ...groupOverrides?.admin,
    },
    fields:
      typeof groupOverrides?.fields === 'function'
        ? groupOverrides.fields({ defaultFields: baseFields })
        : baseFields,
    label: 'Comgate',
  }

  return {
    name: GROUP_NAME,
    confirmOrder: async ({ data, ordersSlug = 'orders', req, transactionsSlug = 'transactions' }) => {
      const { payload } = req

      const transactionID = data?.transactionID

      if (!transactionID) {
        throw new Error('Chýba identifikátor transakcie.')
      }

      const transaction = (await payload.findByID({
        id: transactionID as number | string,
        collection: transactionsSlug as CollectionSlug,
        depth: 0,
        req,
      })) as Transaction

      const transactionCartID =
        transaction?.cart && typeof transaction.cart === 'object'
          ? transaction.cart.id
          : transaction?.cart

      if (!transactionCartID || String(transactionCartID) !== String(data?.cartID)) {
        throw new Error('Transakcia nepatrí k tomuto košíku.')
      }

      // The status push (server-to-server, secret-verified) is the only writer
      // of paid orders. If it has not arrived yet, say so rather than creating
      // an order the shop was never paid for.
      if (!transaction.order) {
        throw new Error('Platba zatiaľ nebola potvrdená platobnou bránou.')
      }

      const orderID =
        typeof transaction.order === 'object' ? transaction.order.id : transaction.order

      const order = (await payload.findByID({
        id: orderID,
        collection: ordersSlug as CollectionSlug,
        depth: 0,
        req,
      })) as Order

      return {
        accessToken: (order as unknown as { accessToken?: string }).accessToken ?? '',
        message: 'Platba bola potvrdená.',
        orderID: order.id,
        transactionID: transaction.id,
      }
    },
    group,
    initiatePayment: async ({ data, req, transactionsSlug }) => {
      const { payload } = req
      const { billingAddress, cart, currency, customerEmail, shippingAddress } = data

      if (!getComgateConfig()) {
        throw new Error(
          'Platba kartou nie je nakonfigurovaná (chýba COMGATE_MERCHANT/COMGATE_SECRET).',
        )
      }
      if (!cart?.items?.length) {
        throw new Error('Košík je prázdny.')
      }
      if (!customerEmail) {
        throw new Error('Na dokončenie objednávky je potrebný e-mail.')
      }

      await assertCartIsNotPurchased({ cartID: cart.id, req })

      const requestData = (req.data ?? {}) as Record<string, unknown>

      // Server-loaded cart subtotal — the basis for both the free-delivery
      // threshold and the discount, never a number the browser sent.
      const subtotal = cart.subtotal ?? 0

      const fees = await resolveFees({
        discountCode: requestData.discountCode,
        paymentMethodID: requestData.paymentMethodID,
        req,
        shippingMethodID: requestData.shippingMethodID,
        subtotal,
      })

      if (!fees.paymentMethod?.enabled || fees.paymentType !== 'card') {
        throw new Error('Zvolený spôsob platby nie je dostupný.')
      }
      if (!fees.shippingMethod?.enabled) {
        throw new Error('Zvolený spôsob dopravy nie je dostupný.')
      }
      // Re-validated at order creation — see the same guard in the manual
      // adapter. The price sent to the gateway must be the price we can defend.
      if (fees.discountError) {
        throw new Error(fees.discountError)
      }

      const items = flattenCartItems(cart)
      const amount = calculateOrderTotal(subtotal, fees)

      if (!amount || amount <= 0) {
        throw new Error('Neplatná suma objednávky.')
      }

      const transaction = await payload.create({
        collection: transactionsSlug as CollectionSlug,
        data: {
          ...(req.user ? { customer: req.user.id } : {}),
          amount,
          billingAddress,
          cart: cart.id,
          [GROUP_NAME]: {
            codFee: fees.codFee,
            discountAmount: fees.discountAmount,
            discountCode: fees.discountCode,
            discountCodeID: fees.discountCodeID != null ? String(fees.discountCodeID) : null,
            paymentType: fees.paymentType,
            shippingAddressSnapshot: (shippingAddress ?? billingAddress) as unknown as Record<string, unknown>,
            shippingFee: fees.shippingFee,
            shippingMethodID: fees.shippingMethodID != null ? String(fees.shippingMethodID) : null,
          },
          currency: currency.toUpperCase() as Order['currency'],
          customerEmail,
          items,
          paymentMethod: GROUP_NAME,
          status: 'pending',
        },
        req,
      })

      // verified(comgate-docs): `refId` is documented as "suitable for entering a
      // variable symbol or order number... it does not have to be unique"
      // (api-overview.md / openapi `refId` description) — there's no length limit or
      // uniqueness requirement on it. (The 1–16 char limit is on `label`, not `refId`;
      // the earlier version of this comment conflated the two.) With this plugin the
      // order only exists *after* the payment is confirmed — creating one up front
      // would leave an abandoned order behind for every dropped card payment — so the
      // transaction ID is used as our stable reference instead, and the status push
      // resolves it back to a transaction.
      const refId = String(transaction.id)

      // verified(comgate-docs): `fullName` is a required create-payment field
      // (openapi `required` array; api-overview.md required-fields table). Built from
      // the billing address the shopper already typed in, falling back to the email
      // local part so the field is never empty.
      const fullName =
        [billingAddress?.firstName, billingAddress?.lastName]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(' ')
          .trim() || customerEmail

      let created: { redirect: string; transId: string }

      try {
        created = await createComgatePayment({
          email: customerEmail,
          fullName,
          label: `Objednavka ${refId}`,
          price: amount,
          refId,
          returnURL: `${getServerSideURL()}${COMGATE_RETURN_PATH}`,
        })
      } catch (error) {
        await payload.update({
          id: transaction.id,
          collection: transactionsSlug as CollectionSlug,
          data: { status: 'failed' },
          req,
        })
        throw error
      }

      await payload.update({
        id: transaction.id,
        collection: transactionsSlug as CollectionSlug,
        data: {
          [GROUP_NAME]: {
            refId,
            transId: created.transId,
          },
        },
        req,
      })

      return {
        amount,
        message: 'Platba bola vytvorená, presmerúvame na platobnú bránu.',
        redirectURL: created.redirect,
        transactionID: transaction.id,
        transId: created.transId,
      }
    },
    label,
  }
}

/**
 * Promote a Comgate transaction into a paid order. Called only from the
 * secret-verified status route handler.
 */
export const completeComgateTransaction = async ({
  req,
  transaction,
}: {
  req: Parameters<typeof createOrderFromTransaction>[0]['req']
  transaction: Transaction
}) => {
  const group = readCarryGroup(transaction, GROUP_NAME)

  return createOrderFromTransaction({
    // Nothing else decrements stock on this path — the plugin's confirm-order
    // endpoint is not involved in a gateway callback.
    decrementInventory: true,
    group,
    req,
    transaction,
    transactionStatus: 'succeeded',
  })
}
