'use client'

import React from 'react'
import type { Address } from '@/payload-types'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { countryLabel, formatPostalCode } from '@/components/addresses/slots'
import { Edit2, MapPin, Phone, Tag } from 'lucide-react'

type Props = {
  address: Partial<Omit<Address, 'country'>> & { country?: string } // Allow address to be partial and entirely optional as this is entirely for display purposes
  /**
   * Completely override the default actions
   */
  actions?: React.ReactNode
  /**
   * Insert elements before the actions
   */
  beforeActions?: React.ReactNode
  /**
   * Insert elements after the actions
   */
  afterActions?: React.ReactNode
  /**
   * Hide all actions
   */
  hideActions?: boolean
}

export const AddressItem: React.FC<Props> = ({
  address,
  actions,
  hideActions = false,
  beforeActions,
  afterActions,
}) => {
  if (!address) {
    return null
  }

  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0 grow">
          <p className="text-sm font-bold text-black">
            {address.title && <span>{address.title} </span>}
            {address.firstName} {address.lastName}
          </p>
          {address.company && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-gray-500">
              <Tag className="size-3" /> {address.company}
            </p>
          )}
          {address.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <Phone className="size-3" /> {address.phone}
            </p>
          )}
        </div>
      </div>

      <p className="pl-11 text-sm leading-relaxed text-gray-600">
        {address.addressLine1}
        {address.addressLine2 && <>, {address.addressLine2}</>}
        <br />
        {/* Slovak address order: PSČ before the city. */}
        {[formatPostalCode(address.postalCode), address.city].filter(Boolean).join(' ')}
        {address.state ? `, ${address.state}` : ''}
        <br />
        {countryLabel(address.country)}
      </p>

      {!hideActions && address.id && (
        <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pl-11 pt-4">
          {actions ? (
            actions
          ) : (
            <>
              {beforeActions}
              {address.id && (
                <CreateAddressModal
                  addressID={address.id}
                  initialData={address}
                  buttonText="Upraviť"
                  buttonIcon={<Edit2 className="size-3" />}
                  buttonVariant="link"
                  modalTitle="Upraviť adresu"
                />
              )}
              {afterActions}
            </>
          )}
        </div>
      )}
    </div>
  )
}
