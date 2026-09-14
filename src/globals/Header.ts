import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { link } from '@/fields/link'
import { TOP_BAR_LINKS } from '@/lib/navigation'

import { globalCacheTag, revalidateGlobalHook } from './revalidateGlobal'

/** Cache tag the storefront header reads under (see `getCachedGlobal`). */
export const HEADER_TAG = globalCacheTag('header')

/**
 * Navigation. Two levels now:
 *
 *   - `navItems` — the white desktop strip and the mobile menu's large list.
 *     Each entry may carry an optional `children` array (one level deep only);
 *     the desktop strip turns those into a hover dropdown, the mobile menu
 *     indents them under their parent.
 *   - `topBar.links` — the thin cream utility bar's right-hand links, which the
 *     mobile menu also renders as its secondary row. Seeded (via
 *     `defaultValue`) with exactly the four links both used to hard-code.
 */
export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Hlavička (navigácia)',
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    afterChange: [revalidateGlobalHook('header', 'header navigation')],
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      label: 'Hlavné menu',
      fields: [
        link({
          appearances: false,
        }),
        {
          name: 'children',
          type: 'array',
          label: 'Podpoložky (voliteľné)',
          labels: { plural: 'Podpoložky', singular: 'Podpoložka' },
          admin: {
            description:
              'Jedna úroveň. Na počítači sa zobrazia ako rozbaľovacie menu, na mobile odsadené pod rodičom.',
          },
          maxRows: 8,
          fields: [
            link({
              appearances: false,
            }),
          ],
        },
      ],
      maxRows: 6,
    },
    {
      name: 'topBar',
      type: 'group',
      label: 'Horná lišta',
      admin: {
        description:
          'Odkazy vpravo v tenkej krémovej lište nad hlavičkou. Rovnaký zoznam sa zobrazuje aj v mobilnom menu.',
      },
      fields: [
        {
          name: 'links',
          type: 'array',
          label: 'Odkazy',
          labels: { plural: 'Odkazy', singular: 'Odkaz' },
          defaultValue: TOP_BAR_LINKS.map((item) => ({
            href: item.href,
            highlight: item.highlight,
            icon: item.icon,
            label: item.label,
          })),
          maxRows: 8,
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  label: 'Popis',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'href',
                  type: 'text',
                  label: 'Odkaz',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'icon',
                  type: 'select',
                  defaultValue: 'none',
                  label: 'Ikona',
                  options: [
                    { label: 'Žiadna', value: 'none' },
                    { label: 'Blog (kniha)', value: 'BookOpen' },
                    { label: 'Telefón', value: 'Phone' },
                    { label: 'E-mail', value: 'Mail' },
                  ],
                  admin: { width: '50%' },
                },
                {
                  name: 'highlight',
                  type: 'checkbox',
                  label: 'Zvýrazniť (tmavší text + oddeľovač za odkazom)',
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
