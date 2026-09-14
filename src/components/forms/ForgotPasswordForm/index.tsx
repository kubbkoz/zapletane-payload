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
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
}

export const ForgotPasswordForm: React.FC = () => {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(async (data: FormData) => {
    setIsLoading(true)
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/forgot-password`,
      {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    )
    setIsLoading(false)

    if (response.ok) {
      setSuccess(true)
      setError('')
    } else {
      setError('Nepodarilo sa odoslať email na obnovenie hesla. Skúste to prosím znova.')
    }
  }, [])

  if (success) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle className="mb-5 size-16 text-success" />
        <h1 className="mb-2 font-sans text-lg font-black uppercase tracking-wide text-black">
          Email bol odoslaný
        </h1>
        <p className="mb-8 max-w-xs text-sm text-gray-500">
          Ak je tento email v našej databáze, čoskoro dostanete odkaz na zmenu hesla.
        </p>
        <Button asChild variant="outline" className="rounded-default border-gray-200">
          <Link href="/login">Späť na prihlásenie</Link>
        </Button>
      </div>
    )
  }

  return (
    <Fragment>
      <h1 className="section-h2 mb-3 text-center text-[32px] sm:text-[38px]">Obnovenie hesla</h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        Zadajte Váš email a pošleme Vám odkaz na vytvorenie nového hesla.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {error && (
          <div className={`${errorBannerClassName} mb-6`}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
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
              {...register('email', { required: 'Zadajte prosím Váš email.' })}
            />
          </div>
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <Button className={`${primarySubmitClassName} mt-6`} disabled={isLoading} type="submit">
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          {isLoading ? 'Odosielam...' : 'Odoslať odkaz'}
        </Button>
      </form>
    </Fragment>
  )
}
