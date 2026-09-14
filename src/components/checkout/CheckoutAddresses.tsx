'use client'

import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Address } from '@/payload-types'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { useState } from 'react'

type Props = {
  selectedAddress?: Address
  setAddress: React.Dispatch<React.SetStateAction<Partial<Address> | undefined>>
  heading?: string
  description?: string
  setSubmit?: React.Dispatch<React.SetStateAction<() => void | Promise<void>>>
}

/**
 * Address picker for the checkout flow — visual layer only, all `useAddresses`
 * wiring untouched. Slovak copy per DESIGN-SPEC §5.
 */
export const CheckoutAddresses: React.FC<Props> = ({
  setAddress,
  heading = 'Adresy',
  description = 'Vyberte si alebo pridajte fakturačnú a doručovaciu adresu.',
}) => {
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="font-sans text-sm text-gray-600">
          Nemáte uloženú žiadnu adresu. Pridajte prosím novú.
        </p>

        <CreateAddressModal />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-sans text-base font-bold text-black">{heading}</h3>
        <p className="mt-1 font-sans text-sm text-gray-600">{description}</p>
      </div>
      <AddressesModal setAddress={setAddress} />
    </div>
  )
}

const AddressesModal: React.FC<Props> = ({ setAddress }) => {
  const [open, setOpen] = useState(false)
  const handleOpenChange = (state: boolean) => {
    setOpen(state)
  }

  const closeModal = () => {
    setOpen(false)
  }
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return (
      <p className="font-sans text-sm text-gray-600">
        Nemáte uloženú žiadnu adresu. Pridajte prosím novú.
      </p>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center justify-center self-start rounded-default border border-brand px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-widest text-brand transition-colors duration-300 hover:bg-brand hover:text-white"
          type="button"
        >
          Vybrať adresu
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-tech text-lg font-bold uppercase tracking-wider text-black">
            Vybrať adresu
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-10">
          <ul className="flex flex-col gap-6">
            {addresses.map((address) => (
              <li className="border-b border-gray-100 pb-6 last:border-none" key={address.id}>
                <AddressItem
                  address={address}
                  beforeActions={
                    <button
                      className="inline-flex items-center justify-center rounded-default border border-accent bg-accent px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors duration-300 hover:bg-accent-dark"
                      onClick={(e) => {
                        e.preventDefault()
                        setAddress(address)
                        closeModal()
                      }}
                      type="button"
                    >
                      Vybrať
                    </button>
                  }
                />
              </li>
            ))}
          </ul>

          <CreateAddressModal />
        </div>
      </DialogContent>
    </Dialog>
  )
}
