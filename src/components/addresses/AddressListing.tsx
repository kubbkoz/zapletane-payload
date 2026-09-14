'use client'

import React from 'react'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { AddressItem } from '@/components/addresses/AddressItem'
import { MapPin } from 'lucide-react'

export const AddressListing: React.FC = () => {
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-default border border-gray-100 bg-gray-50 px-8 py-14 text-center">
        <MapPin className="size-8 text-gray-300" strokeWidth={1.5} />
        <p className="text-sm text-gray-400">Nemáte uložené žiadne adresy.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {addresses.map((address) => (
        <div
          key={address.id}
          className="rounded-default border border-gray-100 bg-gray-50 p-6 transition-colors hover:border-brand/40"
        >
          <AddressItem address={address} />
        </div>
      ))}
    </div>
  )
}
