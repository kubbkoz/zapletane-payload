import type { PaymentAdapter, PaymentAdapterArgs } from '@payloadcms/plugin-ecommerce/types'
import type { CollectionSlug, GroupField } from 'payload'

import type { Order, Transaction } from '@/payload-types'

import {
  checkoutCarryFields,
  createOrderFromTransaction,
  flattenCartItems,
  readCarryGroup,
} from '@/payments/shared/orders'
import { calculateOrderTotal, resolveFees } from '@/payments/shared/fees'

/**
 * "Manual" (offline) payment adapter — dobierka a bankový prevod.
 *
 * `@payloadcms/plugin-ecommerce` has no built-in offline payment method: every
 * order is created by an adapter's `confirmOrder`, and the only adapter it
 * ships is Stripe. So instead of hand-rolling order creation next to the
 * plugin (and losing its stock validation, inventory decrement and cart
 * teardown), this implements the same `PaymentAdapter` contract with no
 * gateway behind it:
 *
 *   POST /api/payments/manual/initiate      -> validates stock + prices (the
 *                                              plugin's own endpoint does this),
 *                                              then writes a pending transaction
 *                                              holding the cart snapshot, the
 *                                              resolved fees and the shipping
 *                                              address.
 *   POST /api/payments/manual/confirm-order -> promotes that transaction into an
 *                                              order; the plugin's endpoint then
 *                                              decrements inventory for us.
 *
 * The transaction deliberately stays `pending` afterwards: with dobierka and
 * prevod no money has moved yet, so "succeeded" would be a lie. It flips when
 * the shop marks the order paid.
 */

import { MANUAL_PAYMENT_NAME as GROUP_NAME } from '@/payments/manual/constants'

export const manualAdapter = (props: PaymentAdapterArgs = {}): PaymentAdapter => {
  const { groupOverrides } = props
  const label = props.label || 'Dobierka / prevod'

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
        ? groupOverrides.fields({ defaultFields: checkoutCarryFields })
        : checkoutCarryFields,
    label: 'Platba pri prevzatí / prevodom',
  }

  return {
    name: GROUP_NAME,
    confirmOrder: async ({
      cartsSlug = 'carts',
      data,
      ordersSlug = 'orders',
      req,
      transactionsSlug = 'transactions',
    }) => {
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

      if (!transaction) {
        throw new Error('Transakcia sa nenašla.')
      }

      // The plugin's confirm-order endpoint already proved the caller owns
      // `data.cartID` (it loads the cart with overrideAccess: false and the
      // guest cart secret). Tying the transaction to that same cart is what
      // stops a stranger from confirming somebody else's checkout.
      const transactionCartID =
        transaction.cart && typeof transaction.cart === 'object'
          ? transaction.cart.id
          : transaction.cart

      if (!transactionCartID || String(transactionCartID) !== String(data?.cartID)) {
        throw new Error('Transakcia nepatrí k tomuto košíku.')
      }

      const group = readCarryGroup(transaction, GROUP_NAME)

      const { order } = await createOrderFromTransaction({
        cartsSlug,
        // The plugin's endpoint decrements stock right after this returns.
        decrementInventory: false,
        group,
        ordersSlug,
        req,
        transaction,
        // Nothing has been collected yet — dobierka is paid to the courier and
        // a bank transfer lands days later.
        transactionStatus: 'pending',
        transactionsSlug,
      })

      return {
        accessToken: (order as unknown as { accessToken?: string }).accessToken ?? '',
        message: 'Objednávka bola vytvorená.',
        orderID: order.id,
        transactionID: transaction.id,
      }
    },
    group,
    initiatePayment: async ({ data, req, transactionsSlug }) => {
      const { payload } = req
      const { billingAddress, cart, currency, customerEmail, shippingAddress } = data

      if (!cart?.items?.length) {
        throw new Error('Košík je prázdny.')
      }
      if (!customerEmail) {
        throw new Error('Na dokončenie objednávky je potrebný e-mail.')
      }

      const requestData = (req.data ?? {}) as Record<string, unknown>

      const fees = await resolveFees({
        paymentMethodID: requestData.paymentMethodID,
        req,
        shippingMethodID: requestData.shippingMethodID,
      })

      if (!fees.paymentMethod?.enabled) {
        throw new Error('Zvolený spôsob platby nie je dostupný.')
      }
      if (fees.paymentType !== 'cod' && fees.paymentType !== 'bankTransfer') {
        throw new Error('Tento spôsob platby sa neuhrádza pri prevzatí ani prevodom.')
      }
      if (!fees.shippingMethod?.enabled) {
        throw new Error('Zvolený spôsob dopravy nie je dostupný.')
      }

      const items = flattenCartItems(cart)
      const amount = calculateOrderTotal(cart.subtotal ?? 0, fees)

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
          currency: currency.toUpperCase() as Order['currency'],
          customerEmail,
          items,
          [GROUP_NAME]: {
            codFee: fees.codFee,
            paymentType: fees.paymentType,
            shippingAddressSnapshot: (shippingAddress ?? billingAddress) as unknown as Record<string, unknown>,
            shippingFee: fees.shippingFee,
            shippingMethodID: fees.shippingMethodID != null ? String(fees.shippingMethodID) : null,
          },
          paymentMethod: GROUP_NAME,
          status: 'pending',
        },
        req,
      })

      return {
        amount,
        codFee: fees.codFee,
        message: 'Objednávka je pripravená na potvrdenie.',
        paymentType: fees.paymentType,
        shippingFee: fees.shippingFee,
        transactionID: transaction.id,
      }
    },
    label,
  }
}
