import { getContact } from '@/utilities/getContact'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import React from 'react'

import { MobileBottomNavClient } from './index.client'

/**
 * Server half of the mobile bottom bar — same shape as `components/Header`:
 * read the globals here, hand plain data to the client component.
 *
 *   - `site-settings` contact facts → the `tel:` / `mailto:` tabs (merged over
 *     the baked constants by `getContact`, so they can never be empty)
 *   - `site-settings.search.placeholder` → the fullscreen search overlay
 *
 * Both reads are the cached ones the header already performs, so this adds no
 * database round-trip.
 */
export async function MobileBottomNav() {
  const [contact, siteSettings] = await Promise.all([getContact(), getSiteSettings()])

  return (
    <MobileBottomNavClient
      contact={contact}
      searchPlaceholder={siteSettings?.search?.placeholder ?? undefined}
    />
  )
}
