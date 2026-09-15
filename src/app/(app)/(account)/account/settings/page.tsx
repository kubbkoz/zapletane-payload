import type { Metadata } from 'next'

import { AccountForm } from '@/components/forms/AccountForm'
import { AccountCard } from '@/components/account/AccountCard'
import { PushOptInInline } from '@/components/Pwa/PushOptIn'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { BellRing, KeyRound, UserRound } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/**
 * „Moje údaje" — the account-details form that used to sit on the hub. Split
 * off so /account can be a dashboard; `AccountForm` already handles name,
 * e-mail and the optional password change in one submit.
 */
export default async function AccountSettingsPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k nastaveniam účtu.')}`,
    )
  }

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[28px] sm:text-[38px]">Moje údaje</h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-gray-600">
          Zmeňte meno, e-mail alebo si nastavte nové heslo.
        </p>
      </div>

      <AccountCard icon={UserRound} title="Údaje účtu">
        <AccountForm />
      </AccountCard>

      <AccountCard
        description="Ak si heslo nepamätáte, pošleme vám e-mailom odkaz na jeho obnovenie."
        icon={KeyRound}
        title="Zabudnuté heslo"
      >
        <Link
          className="inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:text-brand"
          href="/forgot-password"
        >
          Obnoviť heslo e-mailom
        </Link>
      </AccountCard>

      <AccountCard
        description="Push notifikácie o zmene stavu vašich objednávok — priamo do prehliadača alebo nainštalovanej aplikácie."
        icon={BellRing}
        title="Notifikácie"
      >
        <PushOptInInline />
      </AccountCard>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Upravte meno, e-mail a heslo vášho účtu.',
  openGraph: mergeOpenGraph({
    title: 'Moje údaje',
    url: '/account/settings',
  }),
  title: 'Moje údaje',
}
