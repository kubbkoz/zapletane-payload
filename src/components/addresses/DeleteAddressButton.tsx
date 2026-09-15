'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  addressID: number | string
  /** Shown in the toast, e.g. „Fakturačná adresa". */
  label?: string
}

/**
 * Deletes one address through the Payload REST API.
 *
 * Deliberately a *relative* `/api/addresses/:id` request: the auth cookie is
 * same-origin, and the app is served from whatever port/host the browser is
 * already on (the `NEXT_PUBLIC_SERVER_URL` the auth provider hard-codes is
 * wrong in local dev). The plugin's `useAddresses` hook exposes no delete, and
 * its internal cache only ever *sets* a non-empty list, so the server
 * components are re-rendered with `router.refresh()` instead of trusting it.
 *
 * Two-step confirm inline — no `window.confirm`, no extra dialog dependency.
 */
export const DeleteAddressButton: React.FC<Props> = ({ addressID, label = 'Adresa' }) => {
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const onDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/addresses/${addressID}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      toast.success(`${label} bola odstránená.`)
      setConfirming(false)
      router.refresh()
    } catch (_error) {
      toast.error('Adresu sa nepodarilo odstrániť. Skúste to prosím znova.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!confirming) {
    return (
      <button
        className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-error"
        onClick={() => setConfirming(true)}
        type="button"
      >
        <Trash2 className="size-3" />
        Odstrániť
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="font-sans text-[11px] font-medium text-gray-500">Naozaj odstrániť?</span>
      <button
        className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-widest text-error transition-opacity hover:opacity-70 disabled:opacity-50"
        disabled={isDeleting}
        onClick={onDelete}
        type="button"
      >
        {isDeleting && <Loader2 className="size-3 animate-spin" />}
        Áno, odstrániť
      </button>
      <button
        className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-black"
        disabled={isDeleting}
        onClick={() => setConfirming(false)}
        type="button"
      >
        Zrušiť
      </button>
    </span>
  )
}
