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
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
  passwordConfirm: string
}

export const CreateAccountForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const { login } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const onSubmit = useCallback(
    async (data: FormData) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users`, {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const message = response.statusText || 'Nastala chyba pri vytváraní účtu.'
        setError(message)
        return
      }

      const redirect = searchParams.get('redirect')

      const timer = setTimeout(() => {
        setLoading(true)
      }, 1000)

      try {
        await login(data)
        clearTimeout(timer)
        if (redirect) router.push(redirect)
        else router.push(`/account?success=${encodeURIComponent('Účet bol úspešne vytvorený.')}`)
      } catch (_) {
        clearTimeout(timer)
        setError('Nastala chyba pri prihlásení. Skúste to prosím znova.')
      }
    },
    [login, router, searchParams],
  )

  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-4">
        <span className="h-8 w-1.5 shrink-0 bg-brand" />
        <h1 className="font-sans text-3xl font-bold uppercase tracking-tighter text-black">
          Registrácia
        </h1>
      </div>

      <form className="mt-8" onSubmit={handleSubmit(onSubmit)} noValidate>
        {error && (
          <div className={`${errorBannerClassName} mb-6`}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          <FormItem>
            <Label htmlFor="email" className={labelClassName}>
              E-mail *
            </Label>
            <div className={inputIconWrapClassName}>
              <Mail className={inputIconClassName} />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="email@priklad.sk"
                className={inputWithIconClassName}
                {...register('email', { required: 'E-mail je povinný.' })}
              />
            </div>
            {errors.email && <FormError message={errors.email.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="password" className={labelClassName}>
              Heslo * (min. 8 znakov)
            </Label>
            <div className={inputIconWrapClassName}>
              <Lock className={inputIconClassName} />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputWithIconClassName}
                {...register('password', { required: 'Heslo je povinné.' })}
              />
            </div>
            {errors.password && <FormError message={errors.password.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="passwordConfirm" className={labelClassName}>
              Potvrďte heslo *
            </Label>
            <div className={inputIconWrapClassName}>
              <Lock className={inputIconClassName} />
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputWithIconClassName}
                {...register('passwordConfirm', {
                  required: 'Potvrďte prosím heslo.',
                  validate: (value) => value === password.current || 'Heslá sa nezhodujú.',
                })}
              />
            </div>
            {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
          </FormItem>
        </div>

        <Button className={`${primarySubmitClassName} mt-8`} disabled={loading} type="submit">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Registrujem...' : 'Vytvoriť účet'}
        </Button>

        <div className="mt-6 flex flex-col items-center gap-3 border-t border-gray-100 pt-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Už máte účet?{' '}
            <Link href={`/login${allParams}`} className="text-brand hover:underline">
              Prihláste sa
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
