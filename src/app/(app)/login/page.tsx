import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getSafeRedirect } from 'payload/shared'
import { LoginForm } from '@/components/forms/LoginForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { configuredOAuthProviders } from '@/auth/oauth/providers'
import { redirect } from 'next/navigation'

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('Už ste prihlásený.')}`)
  }

  // Server-side gating: the env vars are read here and only the resulting
  // booleans reach the component, so no credential can leak into the HTML.
  const providers = configuredOAuthProviders()
  const { redirect: redirectParam } = await searchParams
  const safeRedirect = getSafeRedirect({ fallbackTo: '/account', redirectTo: redirectParam ?? '' })

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
        <div className="mx-auto mb-8 max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand"
          >
            <ArrowLeft className="size-4" />
            Späť na hlavnú stránku
          </Link>
        </div>

        <div className="mx-auto max-w-md">
          <p className="eyebrow text-center">Môj účet</p>
          <h1 className="section-h2 mt-3 text-center text-[32px] sm:text-[38px]">Prihlásenie</h1>
          <div className="section-decorator mx-auto mt-5" />

          <div className="mt-10 rounded-default border border-gray-100 bg-white p-8 shadow-panel md:p-10">
            <RenderParams className="mb-6" />
            <OAuthButtons providers={providers} redirect={safeRedirect} />
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Prihláste sa alebo si vytvorte účet v ZAPLETANE e-shope.',
  openGraph: {
    title: 'Prihlásenie',
    url: '/login',
  },
  title: 'Prihlásenie',
}
