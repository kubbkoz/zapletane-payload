import type { Footer, Header } from '@/payload-types'

import { CONTACT } from '@/lib/contact'

/**
 * Header / footer navigation defaults + the resolvers that merge the CMS
 * globals over them.
 *
 * Same contract as the homepage content (src/lib/homeDefaults.ts): the globals
 * seed these exact values through `defaultValue`, and every resolver falls back
 * to them when a field is missing — an older saved global (null column) renders
 * precisely what it rendered before the fields existed.
 *
 * No Payload runtime import lives here on purpose: `src/globals/Header.ts` and
 * `src/globals/Footer.ts` import these constants for their defaults.
 */

// --- Top bar ---------------------------------------------------------------

export type TopBarIcon = 'BookOpen' | 'Mail' | 'none' | 'Phone'

export type TopBarLink = {
  id: string
  label: string
  href: string
  icon: TopBarIcon
  /** Darker weight + a hairline divider after the link (the blog entry). */
  highlight: boolean
}

/** The four links the TopBar and the mobile menu used to hard-code. */
export const TOP_BAR_LINKS: TopBarLink[] = [
  { id: 'blog', label: 'Zapletane Blog', href: '/blog', icon: 'BookOpen', highlight: true },
  { id: 'kontakty', label: 'Kontakty', href: '/kontakty', icon: 'none', highlight: false },
  {
    id: 'vsetko-o-nakupe',
    label: 'Všetko o nákupe',
    href: '/vsetko-o-nakupe',
    icon: 'none',
    highlight: false,
  },
  { id: 'o-nas', label: 'O nás', href: '/o-nas', icon: 'none', highlight: false },
]

export function resolveTopBarLinks(header?: Header | null): TopBarLink[] {
  const rows = header?.topBar?.links

  if (!rows?.length) return TOP_BAR_LINKS

  const resolved = rows
    .filter((row) => row?.label && row?.href)
    .map((row, index) => ({
      id: row.id || `top-bar-${index}`,
      label: row.label,
      href: row.href,
      icon: (row.icon || 'none') as TopBarIcon,
      highlight: Boolean(row.highlight),
    }))

  return resolved.length ? resolved : TOP_BAR_LINKS
}

// --- Social links ----------------------------------------------------------

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube'

export type SocialLink = {
  id: string
  platform: SocialPlatform
  url: string
  /** aria-label, since the links are icon-only. */
  label: string
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Sledujte nás na Facebooku',
  instagram: 'Sledujte nás na Instagrame',
  linkedin: 'Sledujte nás na LinkedIne',
  twitter: 'Sledujte nás na X',
  youtube: 'Sledujte nás na Youtube',
}

export const SOCIAL_PLATFORM_OPTIONS = (
  Object.keys(SOCIAL_PLATFORM_LABELS) as SocialPlatform[]
).map((value) => ({
  label: value.charAt(0).toUpperCase() + value.slice(1),
  value,
}))

/** The three icon links the footer and the mobile menu used to hard-code. */
export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'facebook',
    platform: 'facebook',
    url: CONTACT.social.facebook,
    label: SOCIAL_PLATFORM_LABELS.facebook,
  },
  {
    id: 'instagram',
    platform: 'instagram',
    url: CONTACT.social.instagram,
    label: SOCIAL_PLATFORM_LABELS.instagram,
  },
  {
    id: 'youtube',
    platform: 'youtube',
    url: CONTACT.social.youtube,
    label: SOCIAL_PLATFORM_LABELS.youtube,
  },
]

export function resolveSocialLinks(footer?: Footer | null): SocialLink[] {
  const rows = footer?.socialLinks

  if (!rows?.length) return SOCIAL_LINKS

  const resolved = rows
    .filter((row) => row?.platform && row?.url)
    .map((row, index) => {
      const platform = row.platform as SocialPlatform

      return {
        id: row.id || `social-${index}`,
        platform,
        url: row.url as string,
        label: SOCIAL_PLATFORM_LABELS[platform] || platform,
      }
    })

  return resolved.length ? resolved : SOCIAL_LINKS
}

/**
 * Icon-only external links open in a new tab; the placeholder `#` hrefs the
 * brand has not filled in yet must not (a new tab onto the same page is just
 * noise). Matches the pre-CMS markup exactly.
 */
export const isExternalHref = (href: string): boolean => /^https?:\/\//i.test(href)
