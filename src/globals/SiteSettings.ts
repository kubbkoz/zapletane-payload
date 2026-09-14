import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { revalidateTag } from 'next/cache'

import { adminOnly } from '@/access/adminOnly'
import { COMING_SOON_COPY } from '@/components/ComingSoon/copy'
import { CONTACT } from '@/lib/contact'

/**
 * Cache tag the storefront gate reads under (see `getSiteSettings`). Kept in
 * sync with `getCachedGlobal`'s `global_<slug>` convention so a manual
 * `revalidateTag` here and the generic helper never drift apart.
 */
export const SITE_SETTINGS_TAG = 'global_site-settings'

/**
 * Flush the gate's cached copy the moment someone flips the switch — from the
 * admin UI, the REST API or an MCP client. The 30s `revalidate` on the cached
 * read is only the safety net for the cases where this hook cannot run (a
 * direct DB write, or a revalidation outside a Next request scope).
 */
const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    try {
      // 'max' = purge now, regardless of the tag's cache-life profile.
      revalidateTag(SITE_SETTINGS_TAG, 'max')
      payload.logger.info('Revalidated site settings (pre-launch gate)')
    } catch (err) {
      // revalidateTag throws when called outside a Next.js request scope
      // (seed scripts, migrations, a standalone `payload` CLI run). The cached
      // read's own 30s revalidate window covers those.
      payload.logger.warn({ err }, 'Could not revalidate site settings cache tag')
    }
  }

  return doc
}

/**
 * Site-wide switches that are not part of any single page's content.
 *
 * Today that is the pre-launch ("coming soon") gate, which replaces the Nuxt
 * app's file/Redis-backed Nitro toggle (`server/utils/coming-soon-state.ts`)
 * with a Payload global, so it can be flipped from the admin UI or over MCP
 * with no deploy. `comingSoonEnabled` defaults to TRUE: a fresh deploy — one
 * with no row in this table at all — launches gated, exactly like the original
 * baked `COMING_SOON` default.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    description:
      'Site-wide switches. The pre-launch page hides the whole storefront (the /admin panel stays reachable).',
  },
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
  fields: [
    {
      name: 'comingSoonEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Pre-launch page ("Čoskoro spúšťame")',
      admin: {
        description:
          'ON = every storefront page is replaced by the pre-launch page. /admin is unaffected. Owners can preview the real site with ?preview=<COMING_SOON_BYPASS>. Takes effect within a minute.',
      },
    },
    {
      name: 'comingSoon',
      type: 'group',
      label: 'Pre-launch page content',
      admin: {
        description: 'Slovak copy rendered on the pre-launch page. Leave blank to use the default.',
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: COMING_SOON_COPY.eyebrow,
          label: 'Eyebrow',
        },
        {
          name: 'title',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.title,
          label: 'Headline',
          admin: {
            description: 'A line break in this field becomes a <br> in the headline.',
          },
        },
        {
          name: 'body',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.body,
          label: 'Lede (also used as the meta description / OG description)',
        },
        {
          name: 'note',
          type: 'textarea',
          defaultValue: COMING_SOON_COPY.note,
          label: 'Note',
        },
        {
          name: 'phone',
          type: 'text',
          defaultValue: CONTACT.phone.display,
          label: 'Phone (primary contact button)',
        },
        {
          name: 'email',
          type: 'text',
          defaultValue: CONTACT.email.info,
          label: 'E-mail (secondary contact button)',
        },
      ],
    },
  ],
}
