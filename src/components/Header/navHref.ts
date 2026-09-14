import type { Header } from '@/payload-types'

type NavLink = NonNullable<Header['navItems']>[number]['link']

/**
 * The href a nav entry points at — the same resolution `CMSLink` does
 * internally (an internal reference becomes `/<slug>`, a custom link keeps its
 * URL), exposed on its own because the mobile menu needs a plain `<Link>` it
 * can attach an onClick to, and the desktop nav needs the value to decide
 * which entry is active.
 */
export function navHref(link: NavLink | null | undefined): string {
  if (!link) return '/'

  if (link.type === 'reference' && typeof link.reference?.value === 'object') {
    const slug = link.reference.value?.slug

    if (slug) return `/${slug}`
  }

  return link.url || '/'
}
