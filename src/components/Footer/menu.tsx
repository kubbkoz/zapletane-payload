import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { ChevronRight } from 'lucide-react'
import React from 'react'

interface Props {
  menu: Footer['navItems']
}

/**
 * Footer "Kategórie" column (DESIGN-SPEC.md §2.2): each row gets a ChevronRight
 * that fades in on hover while the label nudges right (`hover:pl-2`).
 * `group` is added explicitly — it is a marker class, so it can never be baked
 * into a component shortcut.
 */
export function FooterMenu({ menu }: Props) {
  if (!menu?.length) return null

  return (
    <nav>
      <ul className="space-y-4 text-sm font-medium text-gray-300">
        {menu.map((item) => (
          <li key={item.id}>
            <CMSLink
              {...item.link}
              appearance="inline"
              className="group flex items-center transition-all hover:pl-2 hover:text-accent"
              label={null}
            >
              <ChevronRight className="mr-2 h-3 w-3 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
              {item.link?.label}
            </CMSLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
