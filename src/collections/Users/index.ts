import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { publicAccess } from '@/access/publicAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    unlock: adminOnly,
    update: adminOrSelf,
  },
  admin: {
    group: 'Users',
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'admin',
          value: 'admin',
        },
        {
          label: 'customer',
          value: 'customer',
        },
      ],
    },
    // --- OAuth identity (X3) ----------------------------------------------
    // Additive and optional: an account created through the e-mail form leaves
    // both empty and keeps logging in with its password exactly as before.
    //
    // Field-level write access is admin-only on purpose. The collection lets a
    // customer PATCH their own document (`adminOrSelf`), and without this a
    // shopper could paste somebody else's Google `sub` onto their own account —
    // after which the victim's next "Pokračovať cez Google" would resolve to
    // the attacker's row. Only the OAuth callback writes these, and it does so
    // with `overrideAccess: true`.
    {
      name: 'oauthProvider',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        description:
          'Externý poskytovateľ prihlásenia prepojený s účtom. Prázdne = klasické prihlásenie e-mailom a heslom.',
        position: 'sidebar',
        readOnly: true,
      },
      label: 'Prihlásenie cez',
      options: [
        { label: 'Google', value: 'google' },
        { label: 'Facebook', value: 'facebook' },
      ],
    },
    {
      name: 'oauthSub',
      type: 'text',
      access: {
        create: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        description: 'Stabilný identifikátor účtu u poskytovateľa (Google `sub`, Facebook `id`).',
        position: 'sidebar',
        readOnly: true,
      },
      index: true,
      label: 'ID u poskytovateľa',
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
