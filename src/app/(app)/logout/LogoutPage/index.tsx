'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/Auth'
import { CheckCircle, Info } from 'lucide-react'
import Link from 'next/link'
import React, { Fragment, useEffect, useState } from 'react'

export const LogoutPage: React.FC = () => {
  const { logout } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout()
        setSuccess('Boli ste úspešne odhlásený.')
      } catch (_) {
        setError('Už ste odhlásený.')
      }
    }

    void performLogout()
  }, [logout])

  return (
    <Fragment>
      {(error || success) && (
        <div className="flex flex-col items-center rounded-default border border-gray-100 bg-white p-10 text-center shadow-panel">
          {success ? (
            <CheckCircle className="mb-5 size-14 text-success" />
          ) : (
            <Info className="mb-5 size-14 text-gray-300" />
          )}
          <h1 className="mb-3 font-sans text-xl font-black uppercase tracking-wide text-black">
            {error || success}
          </h1>
          <p className="mb-8 max-w-xs text-sm text-gray-500">Čo by ste chceli spraviť ďalej?</p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="rounded-default border-gray-200 text-[11px] font-bold uppercase tracking-widest hover:border-brand hover:text-brand"
            >
              <Link href="/shop">Pokračovať v nákupe</Link>
            </Button>
            <Button asChild className="rounded-default text-[11px] font-bold uppercase tracking-widest">
              <Link href="/login">Prihlásiť sa znova</Link>
            </Button>
          </div>
        </div>
      )}
    </Fragment>
  )
}
