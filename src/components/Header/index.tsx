import { resolveSocialLinks, resolveTopBarLinks, resolveTopBarSettings } from '@/lib/navigation'
import { getContact } from '@/utilities/getContact'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getSiteSettings } from '@/utilities/getSiteSettings'

import './index.css'
import { HeaderClient } from './index.client'

/**
 * Server half of the navbar: reads every global the header renders from and
 * hands plain data to the client component.
 *
 * Three cached globals, each with its own tag and afterChange hook:
 *   - `global_header`        nav items (+ their optional children), the
 *                            TopBar's link array and its on/off + content
 *                            mode (topBar.enabled/mode/marqueeText/marqueeSpeed)
 *   - `global_site-settings` contact facts (phone / e-mail), merged over the
 *                            baked constants by `getContact`
 *   - `global_footer`        social links — the footer is their home, and the
 *                            mobile menu renders the same list so editors keep
 *                            a single place to change them
 */
export async function Header() {
  const [header, footer, contact, siteSettings] = await Promise.all([
    getCachedGlobal('header', 1)(),
    getCachedGlobal('footer', 0)(),
    getContact(),
    getSiteSettings(),
  ])

  return (
    <HeaderClient
      contact={contact}
      header={header}
      searchPlaceholder={siteSettings?.search?.placeholder ?? undefined}
      socialLinks={resolveSocialLinks(footer)}
      topBar={resolveTopBarSettings(header)}
      topBarLinks={resolveTopBarLinks(header)}
    />
  )
}
