import type { Access, CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'
import { isDocumentOwner } from '@/access/isDocumentOwner'

/**
 * A logged-in shopper may register a browser for push; a guest may not.
 *
 * `create` access in Payload is boolean-only (no `Where` narrowing is possible
 * on a document that does not exist yet), so ownership cannot be enforced
 * here — the `pinSubscriptionToRequestingUser` hook below does that instead.
 */
const authenticatedOnly: Access = ({ req: { user } }) => Boolean(user)

/**
 * Push odbery — one document per (customer, browser) pair.
 *
 * A Web Push subscription is a triple: the push service `endpoint` URL that
 * identifies one browser install, plus the `p256dh`/`auth` keys that encrypt
 * the payload so the push service itself cannot read it. All three come
 * straight from `PushManager.subscribe()` in the browser and are stored
 * verbatim — `web-push` hands them back to the service unchanged.
 *
 * `endpoint` is the natural key (unique + indexed): a browser that
 * re-subscribes gets the same endpoint back, so POST /api/push/subscribe
 * upserts on it rather than accumulating a row per visit. Subscriptions are
 * also disposable by design — the push service expires them, and
 * `sendPushToCustomer` deletes any that come back 404/410 Gone.
 *
 * These rows are not secrets in the credential sense, but they are personal
 * data (they identify a shopper's browser and can be used to notify it), so
 * read/update/delete are scoped to the owning customer or an admin, exactly
 * like the addresses/orders collections the ecommerce plugin installs.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  access: {
    create: authenticatedOnly,
    delete: isDocumentOwner,
    read: isDocumentOwner,
    update: isDocumentOwner,
  },
  admin: {
    defaultColumns: ['customer', 'endpoint', 'lastSeenAt', 'updatedAt'],
    description:
      'Prehliadače, ktoré si zapli notifikácie o stave objednávky. Zapisuje ich storefront (Povoliť notifikácie), nie admin — ručne sa tu dá odber nanajvýš zmazať.',
    group: 'Ecommerce',
    useAsTitle: 'endpoint',
  },
  defaultSort: '-lastSeenAt',
  labels: {
    plural: 'Push odbery',
    singular: 'Push odber',
  },
  hooks: {
    beforeValidate: [
      /**
       * Ownership is decided by the session, never by the request body.
       *
       * Without this, any logged-in shopper could POST a subscription
       * document carrying somebody else's `customer` id and start receiving
       * that person's order notifications. Admins keep the ability to set the
       * field explicitly (they manage rows in the admin panel), and a request
       * with no user at all is left alone — `create` access has already
       * rejected it.
       */
      ({ data, req }) => {
        if (!data || !req.user) return data
        if (checkRole(['admin'], req.user)) return data

        return { ...data, customer: req.user.id }
      },
    ],
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      label: 'Zákazník',
      admin: {
        description: 'Účet, ktorému tento prehliadač patrí. Vypĺňa sa automaticky z prihlásenia.',
      },
    },
    {
      name: 'endpoint',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Endpoint',
      admin: {
        description:
          'URL push služby prehliadača (FCM, Mozilla, WNS…). Jednoznačne identifikuje jednu inštaláciu prehliadača.',
      },
    },
    {
      name: 'keys',
      type: 'group',
      label: 'Šifrovacie kľúče',
      admin: {
        description:
          'Z PushManager.subscribe(). Bez nich sa správa nedá zašifrovať a push služba ju odmietne.',
      },
      fields: [
        {
          name: 'p256dh',
          type: 'text',
          required: true,
          label: 'p256dh',
        },
        {
          name: 'auth',
          type: 'text',
          required: true,
          label: 'auth',
        },
      ],
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'Prehliadač',
      admin: {
        description: 'User-Agent pri registrácii — len na orientáciu, ktoré zariadenie to je.',
        position: 'sidebar',
      },
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      label: 'Naposledy potvrdený',
      admin: {
        description:
          'Kedy prehliadač naposledy potvrdil, že odber ešte platí (pri každom otvorení stránky so zapnutými notifikáciami).',
        date: { displayFormat: 'dd.MM.yyyy HH:mm' },
        position: 'sidebar',
      },
    },
  ],
}
