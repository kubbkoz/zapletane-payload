'use client'

import type { Address } from '@/payload-types'
import type { AddressKind } from '@/components/addresses/slots'

import { AccountEmptyState } from '@/components/account/AccountEmptyState'
import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { DeleteAddressButton } from '@/components/addresses/DeleteAddressButton'
import { addressSlotMeta } from '@/components/addresses/slots'
import { Edit2, MapPinPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback } from 'react'

type Props = {
  address?: Address | null
  kind: AddressKind
}

/** Only the editable fields travel into the form — never `id`/`customer`/timestamps. */
const editableFields = (address: Address, kind: AddressKind) => ({
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2,
  city: address.city,
  company: address.company,
  country: address.country ?? 'SK',
  firstName: address.firstName,
  kind,
  lastName: address.lastName,
  phone: address.phone,
  postalCode: address.postalCode,
  state: address.state,
  title: address.title,
})

/**
 * One of the two logical address slots („Fakturačná" / „Dodacia").
 *
 * The slot is what enforces "max one address per kind": when the slot is
 * filled the only call to action is *Upraviť* (an update of that same
 * document), so a second address of the same kind can never be created from
 * the account UI. The `kind` itself rides into the form as `initialData` —
 * `AddressForm` deep-merges `initialData` under the submitted values, so the
 * field needs no input of its own.
 */
export const AddressSlot: React.FC<Props> = ({ address, kind }) => {
  const meta = addressSlotMeta[kind]
  const router = useRouter()

  // Both create and update happen inside the plugin's `useAddresses`; the
  // server components on this page render from the database, so they need a
  // refresh once the write lands.
  const onSaved = useCallback(() => {
    router.refresh()
  }, [router])

  if (!address) {
    return (
      <AccountEmptyState icon={MapPinPlus} text={meta.emptyHint}>
        <CreateAddressModal
          buttonText="Pridať adresu"
          callback={onSaved}
          initialData={{ country: 'SK', kind }}
          modalTitle={`Pridať ${meta.accusative}`}
        />
      </AccountEmptyState>
    )
  }

  return (
    <AddressItem
      address={address}
      actions={
        <>
          <CreateAddressModal
            addressID={address.id}
            buttonIcon={<Edit2 className="size-3" />}
            buttonText="Upraviť"
            buttonVariant="link"
            callback={onSaved}
            initialData={editableFields(address, kind)}
            modalTitle={`Upraviť ${meta.accusative}`}
          />
          <DeleteAddressButton addressID={address.id} label={meta.label} />
        </>
      }
    />
  )
}
