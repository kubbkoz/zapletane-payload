'use client'

import { SlidersHorizontal } from 'lucide-react'
import React, { useState } from 'react'

import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

import { countActiveFilters } from './filterParams'
import { useShopFilterUrl } from './useShopFilterUrl'

type Props = {
  children: React.ReactNode
}

/**
 * Mobile-only "Filtre" trigger + slide-over drawer (item 6 of the /shop
 * filter spec). Desktop never mounts this — `ShopFilters` only renders it
 * inside a `md:hidden` wrapper, the sidebar renders the same `children`
 * inline instead.
 */
export function MobileFiltersDrawer({ children }: Props) {
  const [open, setOpen] = useState(false)
  const { filters, clearAllFilters } = useShopFilterUrl()
  const count = countActiveFilters(filters)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex w-full items-center justify-between gap-2 rounded-default border border-gray-200 bg-white px-4 py-3 font-sans text-sm font-medium text-black transition-colors duration-200 hover:border-brand"
          type="button"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" strokeWidth={2} />
            Filtre
          </span>
          {count > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="w-[88%] gap-0 bg-brand-50 p-0 sm:max-w-sm" side="left">
        <SheetHeader className="border-b border-gray-200 bg-white">
          <SheetTitle className="font-sans text-base font-bold text-black">Filtre</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4">{children}</div>

        <SheetFooter className="flex-row gap-3 border-t border-gray-200 bg-white">
          {count > 0 && (
            <button
              className="btn-secondary inline-flex h-11 flex-1 items-center justify-center px-4 text-xs"
              onClick={() => {
                clearAllFilters()
                setOpen(false)
              }}
              type="button"
            >
              Zrušiť všetky
            </button>
          )}
          <button
            className="btn-primary h-11 flex-1 justify-center"
            onClick={() => setOpen(false)}
            type="button"
          >
            Použiť
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
