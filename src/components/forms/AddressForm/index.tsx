'use client'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { defaultCountries as supportedCountries } from '@payloadcms/plugin-ecommerce/client/react'
import { Address, Config } from '@/payload-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

import { countryLabels } from '@/components/addresses/slots'
import { titles } from './constants'
import { Button } from '@/components/ui/button'
import { deepMergeSimple } from 'payload/shared'
import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import {
  inputClassName,
  labelClassName,
  primarySubmitClassName,
  selectTriggerClassName,
} from '@/components/forms/formStyles'

type AddressFormValues = {
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
}

type Props = {
  addressID?: Config['db']['defaultIDType']
  initialData?: Omit<Address, 'country' | 'id' | 'updatedAt' | 'createdAt'> & { country?: string }
  callback?: (data: Partial<Address>) => void
  /**
   * If true, the form will not submit to the API.
   */
  skipSubmission?: boolean
}

export const AddressForm: React.FC<Props> = ({
  addressID,
  initialData,
  callback,
  skipSubmission,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<AddressFormValues>({
    // Slovak shop: SK is the default country, and it is seeded into the form
    // *state* (not just the select's visible value) so an untouched select
    // still submits a country instead of failing the required check.
    defaultValues: { country: 'SK', ...initialData },
  })

  const { createAddress, updateAddress } = useAddresses()

  const onSubmit = useCallback(
    async (data: AddressFormValues) => {
      const newData = deepMergeSimple(initialData || {}, data)

      if (!skipSubmission) {
        if (addressID) {
          await updateAddress(addressID, newData)
        } else {
          await createAddress(newData)
        }
      }

      if (callback) {
        callback(newData)
      }
    },
    [initialData, skipSubmission, callback, addressID, updateAddress, createAddress],
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormItem className="sm:w-32 sm:shrink-0">
            <Label htmlFor="title" className={labelClassName}>
              Oslovenie
            </Label>

            <Select
              {...register('title')}
              onValueChange={(value) => {
                setValue('title', value, { shouldValidate: true })
              }}
              defaultValue={initialData?.title || ''}
            >
              <SelectTrigger id="title" className={selectTriggerClassName}>
                <SelectValue placeholder="Oslovenie" />
              </SelectTrigger>
              <SelectContent>
                {titles.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.title && <FormError message={errors.title.message} />}
          </FormItem>

          <FormItem className="sm:flex-1">
            <Label htmlFor="firstName" className={labelClassName}>
              Meno*
            </Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              className={inputClassName}
              {...register('firstName', { required: 'Meno je povinné.' })}
            />
            {errors.firstName && <FormError message={errors.firstName.message} />}
          </FormItem>

          <FormItem className="sm:flex-1">
            <Label htmlFor="lastName" className={labelClassName}>
              Priezvisko*
            </Label>
            <Input
              autoComplete="family-name"
              id="lastName"
              className={inputClassName}
              {...register('lastName', { required: 'Priezvisko je povinné.' })}
            />
            {errors.lastName && <FormError message={errors.lastName.message} />}
          </FormItem>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <FormItem className="sm:flex-1">
            <Label htmlFor="phone" className={labelClassName}>
              Telefón
            </Label>
            <Input
              type="tel"
              id="phone"
              autoComplete="mobile tel"
              className={inputClassName}
              {...register('phone')}
            />
            {errors.phone && <FormError message={errors.phone.message} />}
          </FormItem>

          <FormItem className="sm:flex-1">
            <Label htmlFor="company" className={labelClassName}>
              Firma (voliteľné)
            </Label>
            <Input
              id="company"
              autoComplete="organization"
              className={inputClassName}
              {...register('company')}
            />
            {errors.company && <FormError message={errors.company.message} />}
          </FormItem>
        </div>

        <FormItem>
          <Label htmlFor="addressLine1" className={labelClassName}>
            Ulica a číslo*
          </Label>
          <Input
            id="addressLine1"
            autoComplete="address-line1"
            placeholder="Hlavná 123"
            className={inputClassName}
            {...register('addressLine1', { required: 'Ulica a číslo sú povinné.' })}
          />
          {errors.addressLine1 && <FormError message={errors.addressLine1.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="addressLine2" className={labelClassName}>
            Doplnok adresy
          </Label>
          <Input
            id="addressLine2"
            autoComplete="address-line2"
            className={inputClassName}
            {...register('addressLine2')}
          />
          {errors.addressLine2 && <FormError message={errors.addressLine2.message} />}
        </FormItem>

        <div className="flex flex-col gap-4 sm:flex-row">
          <FormItem className="sm:flex-1">
            <Label htmlFor="city" className={labelClassName}>
              Mesto*
            </Label>
            <Input
              id="city"
              autoComplete="address-level2"
              placeholder="Bratislava"
              className={inputClassName}
              {...register('city', { required: 'Mesto je povinné.' })}
            />
            {errors.city && <FormError message={errors.city.message} />}
          </FormItem>

          <FormItem className="sm:w-32 sm:shrink-0">
            <Label htmlFor="postalCode" className={labelClassName}>
              PSČ*
            </Label>
            <Input
              id="postalCode"
              placeholder="831 01"
              className={inputClassName}
              {...register('postalCode', { required: 'PSČ je povinné.' })}
            />
            {errors.postalCode && <FormError message={errors.postalCode.message} />}
          </FormItem>
        </div>

        <FormItem>
          <Label htmlFor="state" className={labelClassName}>
            Kraj
          </Label>
          <Input
            id="state"
            autoComplete="address-level1"
            className={inputClassName}
            {...register('state')}
          />
          {errors.state && <FormError message={errors.state.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="country" className={labelClassName}>
            Krajina*
          </Label>

          <Select
            {...register('country', {
              required: 'Krajina je povinná.',
            })}
            onValueChange={(value) => {
              setValue('country', value, { shouldValidate: true })
            }}
            required
            defaultValue={initialData?.country || 'SK'}
          >
            <SelectTrigger id="country" className={selectTriggerClassName}>
              <SelectValue placeholder="Krajina" />
            </SelectTrigger>
            <SelectContent>
              {supportedCountries.map((country) => {
                const value = typeof country === 'string' ? country : country.value
                // The plugin's country list is English-labelled — the codes a
                // Slovak customer actually picks get a Slovak name.
                const fallbackLabel =
                  typeof country === 'string'
                    ? country
                    : typeof country.label === 'string'
                      ? country.label
                      : value
                const label = countryLabels[value] ?? fallbackLabel

                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {errors.country && <FormError message={errors.country.message} />}
        </FormItem>
      </div>

      <Button type="submit" disabled={isSubmitting} className={primarySubmitClassName}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {isSubmitting ? 'Ukladám...' : 'Uložiť adresu'}
      </Button>
    </form>
  )
}
