import type { ReactNode } from 'react'

import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { RenderParams } from '@/components/RenderParams'
import { AccountNav } from '@/components/AccountNav'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="bg-brand-50">
      <div className="container-page py-12 lg:py-16">
        <RenderParams className="mb-8" />

        <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-10">
          {/* Chip row below lg, sticky sidebar from lg — see AccountNav. */}
          {user && <AccountNav className="min-w-0 shrink-0 lg:w-72" />}

          <div className="flex w-full min-w-0 grow flex-col gap-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
