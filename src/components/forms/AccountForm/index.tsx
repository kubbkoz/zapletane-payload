'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import {
  inputClassName,
  inputIconClassName,
  inputIconWrapClassName,
  inputWithIconClassName,
  labelClassName,
} from '@/components/forms/formStyles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/payload-types'
import { useAuth } from '@/providers/Auth'
import { Loader2, Lock, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormData = {
  email: string
  name: User['name']
  password: string
  passwordConfirm: string
}

export const AccountForm: React.FC = () => {
  const { setUser, user } = useAuth()
  const [changePassword, setChangePassword] = useState(false)

  const {
    formState: { errors, isLoading, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const router = useRouter()

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (user) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/${user.id}`, {
          // Make sure to include cookies with fetch
          body: JSON.stringify(data),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'PATCH',
        })

        if (response.ok) {
          const json = await response.json()
          setUser(json.doc)
          toast.success('Účet bol úspešne aktualizovaný.')
          setChangePassword(false)
          reset({
            name: json.doc.name,
            email: json.doc.email,
            password: '',
            passwordConfirm: '',
          })
        } else {
          toast.error('Nastala chyba pri aktualizácii účtu.')
        }
      }
    },
    [user, setUser, reset],
  )

  useEffect(() => {
    if (user === null) {
      router.push(
        `/login?error=${encodeURIComponent(
          'Pre zobrazenie tejto stránky sa musíte prihlásiť.',
        )}&redirect=${encodeURIComponent('/account')}`,
      )
    }

    // Once user is loaded, reset form to have default values
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        password: '',
        passwordConfirm: '',
      })
    }
  }, [user, router, reset, changePassword])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {!changePassword ? (
        <Fragment>
          <p className="mb-6 text-sm text-gray-500">
            {'Zmeňte údaje svojho účtu nižšie, alebo '}
            <button
              className="font-bold text-brand underline underline-offset-2 hover:no-underline"
              onClick={() => setChangePassword(!changePassword)}
              type="button"
            >
              kliknite sem
            </button>
            {' pre zmenu hesla.'}
          </p>

          <div className="mb-8 flex flex-col gap-5">
            <FormItem>
              <Label htmlFor="email" className={labelClassName}>
                E-mail
              </Label>
              <div className={inputIconWrapClassName}>
                <Mail className={inputIconClassName} />
                <Input
                  id="email"
                  {...register('email', { required: 'Zadajte prosím email.' })}
                  type="email"
                  className={inputWithIconClassName}
                />
              </div>
              {errors.email && <FormError message={errors.email.message} />}
            </FormItem>

            <FormItem>
              <Label htmlFor="name" className={labelClassName}>
                Meno
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Zadajte prosím meno.' })}
                type="text"
                className={inputClassName}
              />
              {errors.name && <FormError message={errors.name.message} />}
            </FormItem>
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <p className="mb-6 text-sm text-gray-500">
            {'Zmeňte heslo nižšie, alebo '}
            <button
              className="font-bold text-brand underline underline-offset-2 hover:no-underline"
              onClick={() => setChangePassword(!changePassword)}
              type="button"
            >
              zrušiť
            </button>
            .
          </p>

          <div className="mb-8 flex flex-col gap-5">
            <FormItem>
              <Label htmlFor="password" className={labelClassName}>
                Nové heslo
              </Label>
              <div className={inputIconWrapClassName}>
                <Lock className={inputIconClassName} />
                <Input
                  id="password"
                  {...register('password', { required: 'Zadajte prosím nové heslo.' })}
                  type="password"
                  className={inputWithIconClassName}
                />
              </div>
              {errors.password && <FormError message={errors.password.message} />}
            </FormItem>

            <FormItem>
              <Label htmlFor="passwordConfirm" className={labelClassName}>
                Potvrďte heslo
              </Label>
              <div className={inputIconWrapClassName}>
                <Lock className={inputIconClassName} />
                <Input
                  id="passwordConfirm"
                  {...register('passwordConfirm', {
                    required: 'Potvrďte prosím nové heslo.',
                    validate: (value) => value === password.current || 'Heslá sa nezhodujú.',
                  })}
                  type="password"
                  className={inputWithIconClassName}
                />
              </div>
              {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
            </FormItem>
          </div>
        </Fragment>
      )}
      <Button
        disabled={isLoading || isSubmitting || !isDirty}
        type="submit"
        className="h-11 rounded-default text-[13px] font-bold uppercase tracking-widest"
      >
        {(isLoading || isSubmitting) && <Loader2 className="size-4 animate-spin" />}
        {isLoading || isSubmitting
          ? 'Prebieha spracovanie...'
          : changePassword
            ? 'Zmeniť heslo'
            : 'Aktualizovať účet'}
      </Button>
    </form>
  )
}
