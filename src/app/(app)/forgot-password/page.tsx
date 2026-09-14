import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'

export default async function ForgotPasswordPage() {
  return (
    <div className="bg-brand-50 py-16 md:py-24">
      <div className="container-page">
        <div className="mx-auto mb-8 max-w-md">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand"
          >
            <ArrowLeft className="size-4" />
            Späť na prihlásenie
          </Link>
        </div>

        <div className="mx-auto max-w-md rounded-default border border-gray-100 bg-white p-8 shadow-panel md:p-10">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Zadajte svoj email a obnovte si zabudnuté heslo.',
  openGraph: mergeOpenGraph({
    title: 'Obnovenie hesla',
    url: '/forgot-password',
  }),
  title: 'Obnovenie hesla',
}
