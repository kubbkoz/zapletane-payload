'use client'

import { Check, Link2, Loader2 } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/utilities/cn'
import { useWishlist } from '@/wishlist/WishlistProvider'

/**
 * „Zdieľať zoznam" (Z10).
 *
 * First click mints a random token, persists it to the user document through
 * the same `PATCH /api/users/:id` the hearts use, and copies
 * `<origin>/wishlist/zdielane/<token>` to the clipboard. Every later click
 * reuses that token, so one account has one stable link.
 *
 * The link is a **capability URL**: anyone holding it can read this wishlist.
 * That is the whole point of a share link, and it is why the public page it
 * opens exposes the saved products only — never the owner's name or e-mail.
 *
 * `navigator.clipboard` needs a secure context and can be refused, so the URL
 * is shown in the toast as a fallback rather than being lost.
 */
export function ShareWishlistButton({ className }: { className?: string }) {
  const wishlist = useWishlist()
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const onShare = useCallback(async () => {
    if (!wishlist || pending) return

    setPending(true)

    try {
      const token = await wishlist.resolveShareToken()

      if (!token) {
        toast.error('Odkaz na zdieľanie sa nepodarilo vytvoriť.')
        return
      }

      const url = `${window.location.origin}/wishlist/zdielane/${token}`

      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
        toast.success('Odkaz skopírovaný')
      } catch {
        toast.success('Odkaz na zdieľanie', { description: url, duration: 10000 })
      }
    } finally {
      setPending(false)
    }
  }, [pending, wishlist])

  if (!wishlist?.isAuthenticated) return null

  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-default border border-gray-200 bg-white px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-600 transition-colors duration-200 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      disabled={pending}
      onClick={() => void onShare()}
      type="button"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Link2 className="size-4" />
      )}
      {copied ? 'Skopírované' : 'Zdieľať zoznam'}
    </button>
  )
}
