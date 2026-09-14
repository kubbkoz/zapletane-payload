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
import React, { useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
}

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const redirect = useRef(searchParams.get('redirect'))
  const { login } = useAuth()
  const router = useRouter()
  const [error, setError] = React.useState<null | string>(null)

  const {
    formState: { errors, isLoading },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        await login(data)
        if (redirect?.current) router.push(redirect.current)
        else router.push('/account')
      } catch (_) {
        setError('Nastala chyba pri prihlásení. Skontrolujte prosím zadané údaje a skúste to znova.')
      }
    },
    [login, router],
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-5">
        {error && (
          <div className={errorBannerClassName}>
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
              {...register('email', { required: 'E-mail je povinný.' })}
            />
          </div>
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <FormItem>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={labelClassName}>
              Heslo
            </Label>
            <Link
              href={`/forgot-password${allParams}`}
              className="text-[10px] font-bold uppercase tracking-widest text-brand hover:underline"
            >
              Zabudli ste heslo?
            </Link>
          </div>
          <div className={inputIconWrapClassName}>
            <Lock className={inputIconClassName} />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputWithIconClassName}
              {...register('password', { required: 'Zadajte prosím heslo.' })}
            />
          </div>
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <Button
          className={primarySubmitClassName}
          disabled={isLoading}
          size="lg"
          type="submit"
          variant="default"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          {isLoading ? 'Prihlasujem...' : 'Prihlásiť sa'}
        </Button>

        <div className="mt-2 flex flex-col items-center gap-3 border-t border-gray-100 pt-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Ešte nemáte účet?
          </p>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-default border-gray-200 text-[13px] font-bold uppercase tracking-widest text-black hover:border-brand hover:text-brand"
          >
            <Link href={`/create-account${allParams}`}>Zaregistrovať sa</Link>
          </Button>
        </div>
      </div>
    </form>
  )
}
