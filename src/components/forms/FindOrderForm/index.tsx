'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import {
  errorBannerClassName,
  inputIconClassName,
  inputIconWrapClassName,
  inputWithIconClassName,
  labelClassName,
  primarySubmitClassName,
} from '@/components/forms/formStyles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { AlertCircle, CheckCircle, Hash, Loader2, Mail } from 'lucide-react'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { sendOrderAccessEmail } from './sendOrderAccessEmail'

type FormData = {
  email: string
  orderID: string
}

type Props = {
  initialEmail?: string
}

export const FindOrderForm: React.FC<Props> = ({ initialEmail }) => {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>({
    defaultValues: {
      email: initialEmail || user?.email,
    },
  })

  const onSubmit = useCallback(async (data: FormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await sendOrderAccessEmail({
        email: data.email,
        orderID: data.orderID,
      })

      if (result.success) {
        setSuccess(true)
      } else {
        setSubmitError(result.error || 'Niečo sa pokazilo. Skúste to prosím znova.')
      }
    } catch {
      setSubmitError('Niečo sa pokazilo. Skúste to prosím znova.')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  if (success) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle className="mb-5 size-16 text-success" />
        <h1 className="mb-2 font-sans text-lg font-black uppercase tracking-wide text-black">
          Skontrolujte svoj email
        </h1>
        <p className="max-w-sm text-sm text-gray-500">
          Ak objednávka s uvedeným emailom a číslom existuje, poslali sme Vám odkaz na zobrazenie
          jej detailu.
        </p>
      </div>
    )
  }

  return (
    <Fragment>
      <h1 className="section-h2 mb-3 text-center text-[32px] sm:text-[38px]">
        Nájsť objednávku
      </h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        Zadajte email a číslo objednávky. Pošleme Vám odkaz na zobrazenie jej detailu.
      </p>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {submitError && (
          <div className={errorBannerClassName}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <FormItem>
          <Label htmlFor="email" className={labelClassName}>
            E-mail
          </Label>
          <div className={inputIconWrapClassName}>
            <Mail className={inputIconClassName} />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vas@email.sk"
              className={inputWithIconClassName}
              {...register('email', { required: 'E-mail je povinný.' })}
            />
          </div>
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="orderID" className={labelClassName}>
            Číslo objednávky
          </Label>
          <div className={inputIconWrapClassName}>
            <Hash className={inputIconClassName} />
            <Input
              id="orderID"
              type="text"
              placeholder="Napr. 20268892"
              className={inputWithIconClassName}
              {...register('orderID', {
                required: 'Číslo objednávky je povinné.',
              })}
            />
          </div>
          {errors.orderID && <FormError message={errors.orderID.message} />}
        </FormItem>

        <Button className={primarySubmitClassName} type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? 'Odosielam...' : 'Nájsť objednávku'}
        </Button>
      </form>
    </Fragment>
  )
}
