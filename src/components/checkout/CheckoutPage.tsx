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
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, ShoppingCart } from 'lucide-react'

import { cssVariables } from '@/cssVariables'
import { CheckoutForm } from '@/components/forms/CheckoutForm'
import { useAddresses, useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps'
import { DeliveryAndPayment } from '@/components/checkout/DeliveryAndPayment'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { Address, PaymentMethod, Product, ShippingMethod, Variant } from '@/payload-types'
import { COMGATE_PAYMENT_NAME } from '@/payments/comgate/constants'
import { MANUAL_PAYMENT_NAME } from '@/payments/manual/constants'

type GalleryItem = NonNullable<Product['gallery']>[number]
type VariantOptionRef = Variant['options'][number]
import { Checkbox } from '@/components/ui/checkbox'
import { AddressItem } from '@/components/addresses/AddressItem'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const apiKey = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
// Real keys only: with the placeholder/dummy key Stripe.js throws at init and
// takes the whole checkout down. The Stripe card path stays available behind a
// real key; without one the storefront simply never offers a Stripe-backed
// payment method (dobierka/prevod/Comgate are unaffected).
const stripeConfigured = /^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(apiKey) && !apiKey.includes('dummy')
const stripe = stripeConfigured ? loadStripe(apiKey) : null

type Props = {
  paymentMethods: PaymentMethod[]
  shippingMethods: ShippingMethod[]
}

/**
 * Checkout flow.
 *
 * Structure: contact details -> addresses -> "Doprava a platba" -> submit.
 * What happens on submit depends entirely on the payment method the shopper
 * picked (W1):
 *
 *   - `cod` / `bankTransfer` -> the `manual` payment adapter creates the order
 *     immediately, no gateway involved (src/payments/manual).
 *   - `card` + Comgate       -> the `comgate` adapter returns a redirect URL and
 *     the browser leaves for the gateway (src/payments/comgate).
 *   - `card` + Stripe        -> the original PaymentIntent + <Elements> flow,
 *     untouched and still gated behind a real publishable key.
 *
 * The skin is the template's: white `rounded-default` panels with hairline
 * `border-gray-200` on the `bg-gray-50` band, `form-label`/`form-input`
 * primitives, the ZAPLETANE stepper, and a sticky order summary whose CTA is
 * the `btn-checkout` accent button (DESIGN-SPEC §3.5). Copy is Slovak per §5.
 */
export const CheckoutPage: React.FC<Props> = ({ paymentMethods, shippingMethods }) => {
  const { user } = useAuth()
  const router = useRouter()
  const { cart, clearCart } = useCart()
  const [error, setError] = useState<null | string>(null)
  /**
   * State to manage the email input for guest checkout.
   */
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [paymentData, setPaymentData] = useState<null | Record<string, unknown>>(null)
  const { confirmOrder, initiatePayment } = usePayments()
  const { addresses } = useAddresses()
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingPayment, setProcessingPayment] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)

  const [selectedShippingID, setSelectedShippingID] = useState<null | number>(
    shippingMethods[0]?.id ?? null,
  )
  const [selectedPaymentID, setSelectedPaymentID] = useState<null | number>(
    paymentMethods[0]?.id ?? null,
  )

  const cartIsEmpty = !cart || !cart.items || !cart.items.length

  const selectedShipping = useMemo(
    () => shippingMethods.find((method) => method.id === selectedShippingID) ?? null,
    [selectedShippingID, shippingMethods],
  )
  const selectedPayment = useMemo(
    () => paymentMethods.find((method) => method.id === selectedPaymentID) ?? null,
    [paymentMethods, selectedPaymentID],
  )

  const subtotal = cart?.subtotal ?? 0
  const shippingFee = selectedShipping?.price ?? 0
  const codFee = selectedPayment?.surcharge ?? 0
  const grandTotal = subtotal + shippingFee + codFee

  const addressesComplete = Boolean(
    (email || user) && billingAddress && (billingAddressSameAsShipping || shippingAddress),
  )
  const canPlaceOrder = Boolean(addressesComplete && selectedShipping && selectedPayment)

  /** Stripe is the only method that renders an inline payment form. */
  const usesStripe = selectedPayment?.type === 'card' && selectedPayment.gateway === 'stripe'

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

  const goToOrder = useCallback(
    (orderID: number | string, accessToken?: string) => {
      const queryParams = new URLSearchParams()

      if (email) {
        queryParams.set('email', email)
      }
      if (accessToken) {
        queryParams.set('accessToken', accessToken)
      }

      const queryString = queryParams.toString()

      clearCart()
      router.push(`/orders/${orderID}${queryString ? `?${queryString}` : ''}`)
    },
    [clearCart, email, router],
  )

  const initiatePaymentIntent = useCallback(
    async (paymentID: string) => {
      try {
        const paymentData = (await initiatePayment(paymentID, {
          additionalData: {
            ...(email ? { customerEmail: email } : {}),
            billingAddress,
            paymentMethodID: selectedPaymentID,
            shippingAddress: billingAddressSameAsShipping ? billingAddress : shippingAddress,
            shippingMethodID: selectedShippingID,
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
    [
      billingAddress,
      billingAddressSameAsShipping,
      email,
      initiatePayment,
      selectedPaymentID,
      selectedShippingID,
      shippingAddress,
    ],
  )

  /**
   * Place the order for every non-Stripe method.
   *
   * Two calls, mirroring what the plugin does for Stripe: `initiate` validates
   * stock/prices and writes a pending transaction, `confirm-order` turns it
   * into an order and decrements inventory. For Comgate the second call never
   * happens here — the browser leaves for the gateway and the secret-verified
   * status push creates the order instead.
   */
  const placeOrder = useCallback(async () => {
    if (!selectedPayment || !selectedShipping) {
      return
    }

    if (usesStripe) {
      await initiatePaymentIntent('stripe')
      return
    }

    const provider =
      selectedPayment.type === 'card' ? COMGATE_PAYMENT_NAME : MANUAL_PAYMENT_NAME

    setSubmitting(true)
    setError(null)

    try {
      const initResult = (await initiatePayment(provider, {
        additionalData: {
          ...(email ? { customerEmail: email } : {}),
          billingAddress,
          paymentMethodID: selectedPayment.id,
          shippingAddress: billingAddressSameAsShipping ? billingAddress : shippingAddress,
          shippingMethodID: selectedShipping.id,
        },
      })) as Record<string, unknown>

      if (provider === COMGATE_PAYMENT_NAME) {
        const redirectURL = initResult?.redirectURL

        if (typeof redirectURL !== 'string' || !redirectURL) {
          throw new Error('Platobná brána nevrátila presmerovanie.')
        }

        window.location.assign(redirectURL)
        return
      }

      setProcessingPayment(true)

      const confirmResult = (await confirmOrder(MANUAL_PAYMENT_NAME, {
        additionalData: {
          ...(email ? { customerEmail: email } : {}),
          transactionID: initResult?.transactionID,
        },
      })) as Record<string, unknown>

      if (!confirmResult?.orderID) {
        throw new Error('Objednávku sa nepodarilo vytvoriť.')
      }

      goToOrder(
        confirmResult.orderID as number | string,
        typeof confirmResult.accessToken === 'string' ? confirmResult.accessToken : undefined,
      )
    } catch (err) {
      setProcessingPayment(false)

      let message = 'Objednávku sa nepodarilo odoslať. Skúste to prosím znova.'

      if (err instanceof Error && err.message) {
        try {
          const parsed = JSON.parse(err.message) as { cause?: { code?: string }; message?: string }
          if (parsed?.cause?.code === 'OutOfStock') {
            message = 'Jeden alebo viac produktov v košíku je vypredaných.'
          } else if (parsed?.message) {
            message = parsed.message
          }
        } catch {
          message = err.message
        }
      }

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [
    billingAddress,
    billingAddressSameAsShipping,
    confirmOrder,
    email,
    goToOrder,
    initiatePayment,
    initiatePaymentIntent,
    selectedPayment,
    selectedShipping,
    shippingAddress,
    usesStripe,
  ])

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="flex w-full flex-col items-center justify-center py-20 text-center">
        <p className="font-sans text-sm font-medium text-gray-600">Spracúvame vašu objednávku...</p>
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
  // once we know who the shopper is and where the parcel goes.
  const currentStep: 1 | 2 | 3 = addressesComplete ? 3 : 2

  const ctaLabel = (() => {
    if (isSubmitting) {
      return 'Odosielam...'
    }
    if (usesStripe) {
      return 'Prejsť k platbe'
    }
    if (selectedPayment?.type === 'card') {
      return 'Zaplatiť kartou'
    }
    return 'Objednať s povinnosťou platby'
  })()

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
                    className="form-input border-gray-200 bg-white"
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

          <DeliveryAndPayment
            disabled={Boolean(paymentData) || isSubmitting}
            onSelectPayment={setSelectedPaymentID}
            onSelectShipping={setSelectedShippingID}
            paymentMethods={paymentMethods}
            selectedPaymentID={selectedPaymentID}
            selectedShippingID={selectedShippingID}
            shippingMethods={shippingMethods}
          />

          {selectedPayment?.type === 'bankTransfer' && (
            <p className="rounded-default border border-brand-200 bg-brand-50 p-4 font-sans text-[13px] leading-relaxed text-gray-700">
              Platobné údaje (IBAN a variabilný symbol) vám zobrazíme hneď po odoslaní objednávky.
              Tovar expedujeme po pripísaní platby na účet.
            </p>
          )}
          {selectedPayment?.type === 'cod' && (
            <p className="rounded-default border border-brand-200 bg-brand-50 p-4 font-sans text-[13px] leading-relaxed text-gray-700">
              Zásielku zaplatíte kuriérovi pri prevzatí.
            </p>
          )}

          {!paymentData && (
            <button
              className="btn-checkout text-xs disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canPlaceOrder || isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void placeOrder()
              }}
              type="button"
            >
              {ctaLabel}
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
            {stripe && paymentData && Boolean(paymentData['clientSecret']) && (
              <section className="rounded-default border border-gray-200 bg-white p-6 pb-10 md:p-8">
                <h2 className="font-sans text-2xl font-bold tracking-tight text-black md:text-3xl">
                  Platba kartou
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
                    let price = product?.priceInEUR

                    const isVariant = Boolean(variant) && typeof variant === 'object'

                    if (isVariant) {
                      price = variant?.priceInEUR

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

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[13px] text-gray-600">Medzisúčet</span>
                  <Price
                    amount={subtotal}
                    as="span"
                    className="font-tech text-sm font-bold text-black"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[13px] text-gray-600">
                    {selectedShipping ? `Doprava — ${selectedShipping.title}` : 'Doprava'}
                  </span>
                  {shippingFee > 0 ? (
                    <Price
                      amount={shippingFee}
                      as="span"
                      className="font-tech text-sm font-bold text-black"
                    />
                  ) : (
                    <span className="font-tech text-[11px] font-bold uppercase tracking-widest text-success">
                      Zadarmo
                    </span>
                  )}
                </div>

                {codFee > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[13px] text-gray-600">
                      {selectedPayment?.type === 'cod'
                        ? 'Dobierka'
                        : (selectedPayment?.title ?? 'Poplatok za platbu')}
                    </span>
                    <Price
                      amount={codFee}
                      as="span"
                      className="font-tech text-sm font-bold text-black"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-end justify-between gap-2 border-t border-gray-200 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Spolu
                </span>
                <Price
                  amount={grandTotal}
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
