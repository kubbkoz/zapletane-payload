'use client'
import { Button, type ButtonProps } from '@/components/ui/button'
import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AddressForm } from '@/components/forms/AddressForm'
import { Address } from '@/payload-types'
import { DefaultDocumentIDType } from 'payload'
import { Plus } from 'lucide-react'

type Props = {
  addressID?: DefaultDocumentIDType
  initialData?: Partial<Omit<Address, 'country'>> & { country?: string }
  buttonText?: string
  buttonIcon?: React.ReactNode
  buttonVariant?: ButtonProps['variant']
  buttonClassName?: string
  modalTitle?: string
  callback?: (address: Partial<Address>) => void
  skipSubmission?: boolean
  disabled?: boolean
}

export const CreateAddressModal: React.FC<Props> = ({
  addressID,
  initialData,
  buttonText = 'Pridať novú adresu',
  buttonIcon,
  buttonVariant = 'outline',
  buttonClassName,
  modalTitle = 'Pridať novú adresu',
  callback,
  skipSubmission,
  disabled,
}) => {
  const [open, setOpen] = useState(false)
  const handleOpenChange = (state: boolean) => {
    setOpen(state)
  }

  const closeModal = () => {
    setOpen(false)
  }

  const handleCallback = (data: Partial<Address>) => {
    closeModal()

    if (callback) {
      callback(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={disabled}>
        <Button
          variant={buttonVariant}
          className={
            buttonClassName ??
            (buttonVariant === 'link'
              ? 'h-auto gap-1.5 p-0 text-[11px] font-bold uppercase tracking-widest text-black hover:text-brand hover:no-underline'
              : 'rounded-default border-gray-200 text-[11px] font-bold uppercase tracking-widest hover:border-brand hover:text-brand')
          }
        >
          {buttonIcon ?? (buttonVariant !== 'link' && <Plus className="size-3.5" />)}
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-default border-gray-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 font-sans text-lg font-black uppercase tracking-wide text-black">
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Táto adresa bude priradená k vášmu účtu.
          </DialogDescription>
        </DialogHeader>

        <AddressForm
          addressID={addressID}
          initialData={initialData}
          callback={handleCallback}
          skipSubmission={skipSubmission}
        />
      </DialogContent>
    </Dialog>
  )
}
