import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { LogoutPage } from './LogoutPage'

export default async function Logout() {
  return (
    <div className="bg-brand-50 py-16 md:py-24">
      <div className="container-page mx-auto max-w-lg">
        <LogoutPage />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Boli ste odhlásený z vášho ZAPLETANE účtu.',
  openGraph: mergeOpenGraph({
    title: 'Odhlásenie',
    url: '/logout',
  }),
  title: 'Odhlásenie',
}
