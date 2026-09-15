'use client'

import type { Address } from '@/payload-types'
import type { AddressKind } from '@/components/addresses/slots'

import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { DeleteAddressButton } from '@/components/addresses/DeleteAddressButton'
import { addressSlotMeta } from '@/components/addresses/slots'
import { Edit2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  address: Address
  /** Which slots are already filled — an occupied slot offers no assign button. */
  takenKinds: AddressKind[]
}

/**
 * An address with no slot — typically saved during checkout, before the
 * account section existed, or by an older build. It is never hidden: the
 * customer can assign it to a free slot, edit it, or delete it.
 */
export const UnassignedAddressCard: React.FC<Props> = ({ address, takenKinds }) => {
  const [assigning, setAssigning] = useState<AddressKind | null>(null)
  const router = useRouter()

  const assign = async (kind: AddressKind) => {
    setAssigning(kind)

    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        body: JSON.stringify({ kind }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      toast.success(`Adresa bola nastavená ako ${addressSlotMeta[kind].label.toLowerCase()}.`)
      router.refresh()
    } catch (_error) {
      toast.error('Adresu sa nepodarilo priradiť. Skúste to prosím znova.')
    } finally {
      setAssigning(null)
    }
  }

  const freeKinds = (Object.keys(addressSlotMeta) as AddressKind[]).filter(
    (kind) => !takenKinds.includes(kind),
  )

  return (
    <div className="rounded-default border border-gray-100 bg-gray-50 p-5 sm:p-6">
      <AddressItem
        address={address}
        actions={
          <>
            {freeKinds.map((kind) => (
              <button
                className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:text-brand disabled:opacity-50"
                disabled={assigning !== null}
                key={kind}
                onClick={() => assign(kind)}
                type="button"
              >
                {assigning === kind && <Loader2 className="size-3 animate-spin" />}
                {`Použiť ako ${addressSlotMeta[kind].accusative}`}
              </button>
            ))}

            <CreateAddressModal
              addressID={address.id}
              buttonIcon={<Edit2 className="size-3" />}
              buttonText="Upraviť"
              buttonVariant="link"
              callback={() => router.refresh()}
              initialData={{
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                company: address.company,
                country: address.country ?? 'SK',
                firstName: address.firstName,
                lastName: address.lastName,
                phone: address.phone,
                postalCode: address.postalCode,
                state: address.state,
                title: address.title,
              }}
              modalTitle="Upraviť adresu"
            />

            <DeleteAddressButton addressID={address.id} />
          </>
        }
      />
    </div>
  )
}
