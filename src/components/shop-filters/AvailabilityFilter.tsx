'use client'

import React from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import { AVAILABILITY_OPTIONS } from './filterParams'
import { useShopFilterUrl } from './useShopFilterUrl'

/** "Dostupnosť" facet — Skladom / Na objednávku, combinable (OR'd together
 * server-side). Each toggle navigates immediately, same as the category
 * checkboxes. */
export function AvailabilityFilter() {
  const { filters, toggleAvailability } = useShopFilterUrl()

  return (
    <div>
      <h3 className="form-label">Dostupnosť</h3>
      <ul className="flex flex-col gap-2.5">
        {AVAILABILITY_OPTIONS.map((option) => {
          const id = `availability-${option.value}`
          const checked = filters.availability.includes(option.value)

          return (
            <li key={option.value}>
              <Label className="cursor-pointer text-[13px] text-gray-700" htmlFor={id}>
                <Checkbox
                  checked={checked}
                  id={id}
                  onCheckedChange={() => toggleAvailability(option.value)}
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
