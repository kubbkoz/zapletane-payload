import { resolveSearchConfig } from '@/lib/search'
import { getContact } from '@/utilities/getContact'
import { getSearchRecommendations } from '@/utilities/getSearchRecommendations'
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
 *   - `site-settings.search.recommendedProducts` / `recommendedCategories` →
 *     the overlay's empty state (Z1). The relationships are stored as ids on a
 *     depth-0 global read, so `getSearchRecommendations` resolves them into the
 *     lean, serializable rows the client overlay renders — and returns empty
 *     lists without touching the database when nothing is configured.
 *
 * The contact/settings reads are the cached ones the header already performs,
 * so they add no database round-trip.
 */
export async function MobileBottomNav() {
  const [contact, siteSettings] = await Promise.all([getContact(), getSiteSettings()])
  const recommendations = await getSearchRecommendations(siteSettings)

  return (
    <MobileBottomNavClient
      contact={contact}
      recommendedCategories={recommendations.categories}
      recommendedProducts={recommendations.products}
      searchMinChars={resolveSearchConfig(siteSettings).minChars}
      searchPlaceholder={siteSettings?.search?.placeholder ?? undefined}
    />
  )
}
