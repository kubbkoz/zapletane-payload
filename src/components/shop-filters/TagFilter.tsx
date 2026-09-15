'use client'

import React from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import { useShopFilterUrl } from './useShopFilterUrl'

export type TagFilterOption = {
  label: string
  value: string
}

type Props = {
  label: string
  options: TagFilterOption[]
  slug: string
}

/**
 * Admin-defined "Štítky" facet (X4) — one checkbox list per `product-filters`
 * doc of type `tags`, rendered from its `label`/`options`. Combinable within
 * itself (OR'd server-side via `filterTags.tag in [...]`), same URL-param and
 * visual language as the built-in `AvailabilityFilter` it sits next to.
 *
 * `slug` is the filter's own identifier — it namespaces the URL param
 * (`f_<slug>`) so two different tag filters never collide, even if they
 * happen to share an option value.
 */
export function TagFilter({ label, options, slug }: Props) {
  const { filters, toggleTagOption } = useShopFilterUrl()
  const selected = filters.tags[slug] ?? []

  if (options.length === 0) return null

  return (
    <div>
      <h3 className="form-label">{label}</h3>
      <ul className="flex flex-col gap-2.5">
        {options.map((option) => {
          const id = `tag-${slug}-${option.value}`
          const checked = selected.includes(option.value)

          return (
            <li key={option.value}>
              <Label className="cursor-pointer text-[13px] text-gray-700" htmlFor={id}>
                <Checkbox
                  checked={checked}
                  id={id}
                  onCheckedChange={() => toggleTagOption(slug, option.value)}
                />
                {option.label}
              </Label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
