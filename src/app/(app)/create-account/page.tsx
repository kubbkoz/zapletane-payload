import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { CreateAccountForm } from '@/components/forms/CreateAccountForm'
import { redirect } from 'next/navigation'

export default async function CreateAccount() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('Už ste prihlásený.')}`)
  }

  return (
    <div className="relative overflow-hidden bg-brand-50 py-16 md:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 -z-0 size-96 rounded-full bg-brand/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 -z-0 size-96 rounded-full bg-brand/5 blur-3xl"
      />

      <div className="container-page relative">
        <div className="mx-auto mb-8 max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand"
          >
            <ArrowLeft className="size-4" />
            Späť na hlavnú stránku
          </Link>
        </div>

        <div className="mx-auto max-w-2xl rounded-default border border-gray-100 bg-white p-8 shadow-panel md:p-12">
          <RenderParams className="mb-6" />
          <CreateAccountForm />
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Vytvorte si zákaznícky účet v ZAPLETANE e-shope a nakupujte rýchlejšie.',
  openGraph: mergeOpenGraph({
    title: 'Registrácia',
    url: '/create-account',
  }),
  title: 'Registrácia',
}
