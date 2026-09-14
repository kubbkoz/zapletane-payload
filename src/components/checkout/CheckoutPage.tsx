'use client'

import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShoppingCart } from 'lucide-react'

import { cssVariables } from '@/cssVariables'
import { CheckoutForm } from '@/components/forms/CheckoutForm'
import { useAddresses, useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { Address, Product, Variant } from '@/payload-types'

type GalleryItem = NonNullable<Product['gallery']>[number]
type VariantOptionRef = Variant['options'][number]
import { Checkbox } from '@/components/ui/checkbox'
import { AddressItem } from '@/components/addresses/AddressItem'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const apiKey = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
const stripe = loadStripe(apiKey)

/**
 * Checkout flow — VISUAL LAYER ONLY.
 *
 * Every hook, effect, Stripe call and state transition below is the template's,
 * untouched; what changed is the skin: white `rounded-default` panels with
 * hairline `border-gray-200` on the `bg-gray-50` band, `form-label`/`form-input`
 * primitives, the ZAPLETANE stepper, and a sticky order summary whose CTA is the
 * `btn-checkout` accent button (DESIGN-SPEC §3.5). Copy is Slovak per §5.
 */
export const CheckoutPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const { cart } = useCart()
  const [error, setError] = useState<null | string>(null)
  /**
   * State to manage the email input for guest checkout.
   */
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [paymentData, setPaymentData] = useState<null | Record<string, unknown>>(null)
  const { initiatePayment } = usePayments()
  const { addresses } = useAddresses()
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingPayment, setProcessingPayment] = useState(false)

  const cartIsEmpty = !cart || !cart.items || !cart.items.length

  const canGoToPayment = Boolean(
    (email || user) && billingAddress && (billingAddressSameAsShipping || shippingAddress),
  )

  // On initial load wait for addresses to be loaded and check to see if we can prefill a default one
  useEffect(() => {
    if (!shippingAddress) {
      if (addresses && addresses.length > 0) {
        const defaultAddress = addresses[0]
        if (defaultAddress) {
          setBillingAddress(defaultAddress)
        }
      }
    }
  }, [addresses])

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
      setEmailEditable(true)
    }
  }, [])

  const initiatePaymentIntent = useCallback(
    async (paymentID: string) => {
      try {
        const paymentData = (await initiatePayment(paymentID, {
          additionalData: {
            ...(email ? { customerEmail: email } : {}),
            billingAddress,
            shippingAddress: billingAddressSameAsShipping ? billingAddress : shippingAddress,
          },
        })) as Record<string, unknown>

        if (paymentData) {
          setPaymentData(paymentData)
        }
      } catch (error) {
        const errorData = error instanceof Error ? JSON.parse(error.message) : {}
        let errorMessage = 'Pri spúšťaní platby nastala chyba.'

        if (errorData?.cause?.code === 'OutOfStock') {
          errorMessage = 'Jeden alebo viac produktov v košíku je vypredaných.'
        }

        setError(errorMessage)
        toast.error(errorMessage)
      }
    },
    [billingAddress, billingAddressSameAsShipping, shippingAddress],
  )

  if (!stripe) return null

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="flex w-full flex-col items-center justify-center py-20 text-center">
        <p className="font-sans text-sm font-medium text-gray-600">Spracúvame vašu platbu...</p>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-default border border-gray-200 bg-white px-8 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
          <ShoppingCart className="size-7" strokeWidth={1.5} />
        </span>
        <h2 className="mt-6 font-sans text-xl font-bold text-black">Váš košík je prázdny</h2>
        <p className="mt-3 text-[13.5px] leading-[1.7] text-gray-700">
          Pridajte si do košíka niečo ručne pletené a vráťte sa k pokladni.
        </p>
        <Link className="btn-primary mt-8" href="/shop">
          Pokračovať v nákupe
        </Link>
      </div>
    )
  }

  // Step 1 (the cart) is behind us the moment this page renders; step 3 opens
  // once Stripe has handed back a client secret.
  const currentStep: 1 | 2 | 3 = paymentData?.['clientSecret'] ? 3 : 2

  return (
    <div className="flex flex-col">
      <div className="rounded-default border border-gray-200 bg-white px-5 py-4">
        <CheckoutSteps current={currentStep} />
      </div>

      <div className="mt-8 flex grow flex-col items-stretch justify-stretch gap-10 md:flex-row md:gap-6 lg:gap-8">
        <div className="flex basis-full flex-col justify-stretch gap-8 lg:basis-2/3">
          <section className="rounded-default border border-gray-200 bg-white p-6 md:p-8">
            <h2 className="font-sans text-2xl font-bold tracking-tight text-black md:text-3xl">
              Kontaktné údaje
            </h2>
            <div className="section-decorator mt-4" />

            {!user && (
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-default bg-gray-50 p-4 font-sans text-sm text-gray-600">
                <Link
                  className="inline-flex items-center rounded-default border border-brand px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-brand transition-colors duration-300 hover:bg-brand hover:text-white"
                  href="/login"
                >
                  Prihlásiť sa
                </Link>
                <span>alebo</span>
                <Link className="underline underline-offset-4 hover:text-brand" href="/create-account">
                  vytvoriť účet
                </Link>
              </div>
            )}

            {user ? (
              <div className="mt-6 rounded-default bg-gray-50 p-4 font-sans text-sm">
                <p className="font-medium text-black">{user.email}</p>
                <p className="mt-1 text-gray-600">
                  {'Nie ste to vy? '}
                  <Link className="underline underline-offset-4 hover:text-brand" href="/logout">
                    Odhlásiť sa
                  </Link>
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-default bg-gray-50 p-4">
                <p className="mb-4 font-sans text-sm text-gray-600">
                  Zadajte e-mail a nakúpte ako hosť.
                </p>

                <FormItem className="mb-6">
                  <Label className="form-label" htmlFor="email">
                    E-mailová adresa
                  </Label>
                  <Input
                    className="form-input"
                    disabled={!emailEditable}
                    id="email"
                    name="email"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                  />
                </FormItem>

                <button
                  className="inline-flex items-center justify-center rounded-default border border-accent bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-widest text-white transition-colors duration-300 hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!email || !emailEditable}
                  onClick={(e) => {
                    e.preventDefault()
                    setEmailEditable(false)
                  }}
                  type="button"
                >
                  Pokračovať ako hosť
                </button>
              </div>
            )}
          </section>

          <section className="rounded-default border border-gray-200 bg-white p-6 md:p-8">
            <h2 className="font-sans text-2xl font-bold tracking-tight text-black md:text-3xl">
              Fakturačná adresa
            </h2>
            <div className="section-decorator mt-4" />

            <div className="mt-6 flex flex-col gap-6">
              {billingAddress ? (
                <div>
                  <AddressItem
                    actions={
                      <button
                        className="btn-secondary px-4 py-2 text-[10px]"
                        disabled={Boolean(paymentData)}
                        onClick={(e) => {
                          e.preventDefault()
                          setBillingAddress(undefined)
                        }}
                        type="button"
                      >
                        Odstrániť
                      </button>
                    }
                    address={billingAddress}
                  />
                </div>
              ) : user ? (
                <CheckoutAddresses heading="Fakturačná adresa" setAddress={setBillingAddress} />
              ) : (
                <CreateAddressModal
                  disabled={!email || Boolean(emailEditable)}
                  callback={(address) => {
                    setBillingAddress(address)
                  }}
                  skipSubmission={true}
                />
              )}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="shippingTheSameAsBilling"
                  checked={billingAddressSameAsShipping}
                  disabled={Boolean(paymentData || (!user && (!email || Boolean(emailEditable))))}
                  onCheckedChange={(state) => {
                    setBillingAddressSameAsShipping(state as boolean)
                  }}
                />
                <Label
                  className="font-sans text-sm font-medium text-gray-700"
                  htmlFor="shippingTheSameAsBilling"
                >
                  Doručovacia adresa je rovnaká ako fakturačná
                </Label>
              </div>

              {!billingAddressSameAsShipping && (
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="form-label">Doručovacia adresa</h3>
                  {shippingAddress ? (
                    <div>
                      <AddressItem
                        actions={
                          <button
                            className="btn-secondary px-4 py-2 text-[10px]"
                            disabled={Boolean(paymentData)}
                            onClick={(e) => {
                              e.preventDefault()
                              setShippingAddress(undefined)
                            }}
                            type="button"
                          >
                            Odstrániť
                          </button>
                        }
                        address={shippingAddress}
                      />
                    </div>
                  ) : user ? (
                    <CheckoutAddresses
                      heading="Doručovacia adresa"
                      description="Vyberte si adresu doručenia."
                      setAddress={setShippingAddress}
                    />
                  ) : (
                    <CreateAddressModal
                      callback={(address) => {
                        setShippingAddress(address)
                      }}
                      disabled={!email || Boolean(emailEditable)}
                      skipSubmission={true}
                    />
                  )}
                </div>
              )}
            </div>
          </section>

          {!paymentData && (
            <button
              className="btn-checkout text-xs disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canGoToPayment}
              onClick={(e) => {
                e.preventDefault()
                void initiatePaymentIntent('stripe')
              }}
              type="button"
            >
              Prejsť k platbe
            </button>
          )}

          {!paymentData?.['clientSecret'] && error && (
            <div className="flex flex-col items-start gap-4">
              <Message error={error} />

              <button
                className="btn-secondary px-6 py-3 text-[11px]"
                onClick={(e) => {
                  e.preventDefault()
                  router.refresh()
                }}
                type="button"
              >
                Skúsiť znova
              </button>
            </div>
          )}

          <Suspense fallback={<React.Fragment />}>
            {/* @ts-ignore */}
            {paymentData && paymentData?.['clientSecret'] && (
              <section className="rounded-default border border-gray-200 bg-white p-6 pb-10 md:p-8">
                <h2 className="font-sans text-2xl font-bold tracking-tight text-black md:text-3xl">
                  Platba
                </h2>
                <div className="section-decorator mt-4 mb-8" />
                {error && <p className="mb-4 font-sans text-sm text-error">{error}</p>}
                <Elements
                  options={{
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        borderRadius: '3px',
                        colorPrimary: '#755650',
                        gridColumnSpacing: '20px',
                        gridRowSpacing: '20px',
                        colorBackground: cssVariables.colors.base0,
                        colorDanger: cssVariables.colors.error500,
                        colorDangerText: cssVariables.colors.error500,
                        colorIcon: cssVariables.colors.base1000,
                        colorText: cssVariables.colors.base1000,
                        colorTextPlaceholder: cssVariables.colors.base500,
                        fontFamily: '"DM Sans", sans-serif',
                        fontSizeBase: '16px',
                        fontWeightBold: '700',
                        fontWeightNormal: '500',
                        spacingUnit: '4px',
                      },
                    },
                    clientSecret: paymentData['clientSecret'] as string,
                  }}
                  stripe={stripe}
                >
                  <div className="flex flex-col gap-8">
                    <CheckoutForm
                      customerEmail={email}
                      billingAddress={billingAddress}
                      setProcessingPayment={setProcessingPayment}
                    />
                    <button
                      className="self-start font-sans text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-brand"
                      onClick={() => setPaymentData(null)}
                      type="button"
                    >
                      Zrušiť platbu
                    </button>
                  </div>
                </Elements>
              </section>
            )}
          </Suspense>
        </div>

        {!cartIsEmpty && (
          <div className="basis-full lg:basis-1/3">
            <div className="sticky top-6 flex flex-col gap-6 rounded-default border border-gray-200 bg-white p-6 md:p-8">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-tight text-black">
                  Vaša objednávka
                </h2>
                <div className="section-decorator mt-4" />
              </div>

              <div className="flex flex-col gap-5">
                {cart?.items?.map((item, index) => {
                  if (typeof item.product === 'object' && item.product) {
                    const {
                      product,
                      product: { meta, title, gallery },
                      quantity,
                      variant,
                    } = item

                    if (!quantity) return null

                    let image = gallery?.[0]?.image || meta?.image
                    let price = product?.priceInUSD

                    const isVariant = Boolean(variant) && typeof variant === 'object'

                    if (isVariant) {
                      price = variant?.priceInUSD

                      const imageVariant = product.gallery?.find((item: GalleryItem) => {
                        if (!item.variantOption) return false
                        const variantOptionID =
                          typeof item.variantOption === 'object'
                            ? item.variantOption.id
                            : item.variantOption

                        const hasMatch = variant?.options?.some((option: VariantOptionRef) => {
                          if (typeof option === 'object') return option.id === variantOptionID
                          else return option === variantOptionID
                        })

                        return hasMatch
                      })

                      if (imageVariant && typeof imageVariant.image !== 'string') {
                        image = imageVariant.image
                      }
                    }

                    return (
                      <div className="flex items-start gap-4" key={index}>
                        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-gray-50">
                          {image && typeof image !== 'string' && (
                            <Media
                              className="h-full w-full"
                              fill
                              imgClassName="object-contain p-2 mix-blend-multiply"
                              resource={image}
                            />
                          )}
                        </div>
                        <div className="flex min-w-0 grow flex-col gap-1">
                          <p className="line-clamp-2 font-sans text-[13px] font-medium leading-snug text-black">
                            {title}
                          </p>
                          {variant && typeof variant === 'object' && (
                            <div className="flex flex-wrap gap-1">
                              {variant.options?.map((option: VariantOptionRef, i: number) => {
                                if (typeof option !== 'object') return null
                                return (
                                  <span
                                    className="inline-flex items-center rounded-sm border border-gray-200 bg-white px-1.5 py-0.5 font-tech text-[10px] font-bold uppercase tracking-wider text-gray-600"
                                    key={i}
                                  >
                                    {option.label}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          <span className="font-tech text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            Množstvo: {quantity}
                          </span>
                        </div>

                        {typeof price === 'number' && (
                          <Price
                            amount={price * quantity}
                            as="span"
                            className="shrink-0 font-tech text-sm font-bold leading-none text-black"
                          />
                        )}
                      </div>
                    )
                  }
                  return null
                })}
              </div>

              <div className="flex items-end justify-between gap-2 border-t border-gray-200 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Spolu
                </span>
                <Price
                  amount={cart.subtotal || 0}
                  as="span"
                  className="font-tech text-2xl font-black leading-none text-black"
                />
              </div>

              <p className="flex items-center gap-2 font-sans text-[11px] text-gray-500">
                <ShieldCheck className="h-4 w-4 text-brand" />
                Bezpečný nákup — SSL šifrovanie
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
