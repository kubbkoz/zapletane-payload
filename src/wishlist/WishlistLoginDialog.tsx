'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

/**
 * "Prihláste sa" — the gate a guest meets when they tap a heart (Z10).
 *
 * Built on the repo's own `ui/dialog` primitive (Radix), so the three ways out
 * come for free and behave exactly as every other modal here: the X in the
 * corner, Escape, and a click on the overlay. The panel itself wears the
 * ZAPLETANE card recipe — white surface, hairline border, `rounded-default`,
 * `shadow-panel` — and the CTA is `btn-primary`, never a pill.
 *
 * Mounted once, by `WishlistProvider`, so every heart on the page (navbar and
 * card alike) opens this one instance.
 */
export function WishlistLoginDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="bg-white sm:max-w-[420px]">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand">
            <Heart className="size-6" strokeWidth={1.75} />
          </span>
          <DialogTitle className="font-sans text-xl font-bold text-black">
            Prihláste sa
          </DialogTitle>
          <DialogDescription className="text-[13.5px] leading-[1.7] text-gray-600">
            Obľúbené kúsky si môžete ukladať po prihlásení.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col items-center gap-4">
          <DialogClose asChild>
            <Link className="btn-primary w-full justify-center" href="/login">
              Prihlásiť sa
            </Link>
          </DialogClose>

          <DialogClose asChild>
            <Link
              className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-brand"
              href="/create-account"
            >
              Vytvoriť účet
            </Link>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
