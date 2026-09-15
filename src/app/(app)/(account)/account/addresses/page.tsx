import type { Metadata } from 'next'

import { AccountCard } from '@/components/account/AccountCard'
import { getAccountAddresses } from '@/components/account/queries'
import { AddressSlot } from '@/components/addresses/AddressSlot'
import { UnassignedAddressCard } from '@/components/addresses/UnassignedAddressCard'
import {
  addressForKind,
  addressKinds,
  addressSlotMeta,
  unassignedAddresses,
  type AddressKind,
} from '@/components/addresses/slots'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { FileText, Truck } from 'lucide-react'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const slotIcons: Record<AddressKind, typeof FileText> = {
  billing: FileText,
  shipping: Truck,
}

export default async function AddressesPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Prihláste sa prosím pre prístup k nastaveniam účtu.')}`,
    )
  }

  const addresses = await getAccountAddresses(user)
  const unassigned = unassignedAddresses(addresses)
  const takenKinds = addressKinds.filter((kind) => Boolean(addressForKind(addresses, kind)))

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[28px] sm:text-[38px]">Moje adresy</h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-gray-600">
          Uložte si fakturačnú a dodaciu adresu — v pokladni ich potom stačí vybrať jedným klikom.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {addressKinds.map((kind) => (
          <AccountCard
            description={addressSlotMeta[kind].description}
            icon={slotIcons[kind]}
            key={kind}
            title={addressSlotMeta[kind].label}
          >
            <AddressSlot address={addressForKind(addresses, kind)} kind={kind} />
          </AccountCard>
        ))}
      </div>

      {unassigned.length > 0 && (
        <AccountCard
          description="Adresy uložené v pokladni, ktoré zatiaľ nepatria do žiadneho zo slotov vyššie."
          title="Ostatné uložené adresy"
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {unassigned.map((address) => (
              <UnassignedAddressCard address={address} key={address.id} takenKinds={takenKinds} />
            ))}
          </div>
        </AccountCard>
      )}
    </>
  )
}

export const metadata: Metadata = {
  description: 'Spravujte fakturačnú a dodaciu adresu vášho účtu.',
  openGraph: mergeOpenGraph({
    title: 'Moje adresy',
    url: '/account/addresses',
  }),
  title: 'Moje adresy',
}
