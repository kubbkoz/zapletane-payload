'use client'

import React from 'react'
import { Banknote, CreditCard, Landmark, MapPin, Package, Truck } from 'lucide-react'

import type { PaymentMethod, ShippingMethod } from '@/payload-types'

import { Price } from '@/components/Price'
import { cn } from '@/utilities/cn'

type Props = {
  disabled?: boolean
  onSelectPayment: (id: number) => void
  onSelectShipping: (id: number) => void
  paymentMethods: PaymentMethod[]
  selectedPaymentID: null | number
  selectedShippingID: null | number
  shippingMethods: ShippingMethod[]
}

const shippingIcons: Record<NonNullable<ShippingMethod['type']>, typeof Truck> = {
  courier: Truck,
  personal: MapPin,
  pickupPoint: Package,
}

const paymentIcons: Record<NonNullable<PaymentMethod['type']>, typeof Truck> = {
  bankTransfer: Landmark,
  card: CreditCard,
  cod: Banknote,
}

/**
 * One selectable method — the radio card from DESIGN-SPEC §3.5: white surface,
 * hairline `border-gray-200`, and on selection the brand border with the
 * `bg-brand-50` wash. The price hugs the right edge so a column of cards reads
 * as a price list.
 */
const MethodCard: React.FC<{
  amount: number
  description?: null | string
  disabled?: boolean
  Icon: typeof Truck
  meta?: null | string
  name: string
  onSelect: () => void
  selected: boolean
  title: string
  zeroLabel?: string
}> = ({ amount, description, disabled, Icon, meta, name, onSelect, selected, title, zeroLabel }) => (
  <label
    className={cn(
      'flex cursor-pointer items-start gap-4 rounded-default border bg-white p-4 transition-colors duration-200',
      selected ? 'border-brand bg-brand-50' : 'border-gray-200 hover:border-brand-300',
      disabled && 'cursor-not-allowed opacity-50',
    )}
  >
    <input
      checked={selected}
      className="sr-only"
      disabled={disabled}
      name={name}
      onChange={onSelect}
      type="radio"
    />

    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        selected ? 'border-brand' : 'border-gray-300',
      )}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', selected ? 'bg-brand' : 'bg-transparent')} />
    </span>

    <Icon
      aria-hidden="true"
      className={cn('mt-0.5 h-5 w-5 shrink-0', selected ? 'text-brand' : 'text-gray-400')}
      strokeWidth={1.75}
    />

    <span className="flex min-w-0 grow flex-col gap-1">
      <span className="font-sans text-sm font-bold text-black">{title}</span>
      {description && (
        <span className="font-sans text-[13px] leading-snug text-gray-600">{description}</span>
      )}
      {meta && (
        <span className="font-tech text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {meta}
        </span>
      )}
    </span>

    {amount > 0 ? (
      <Price
        amount={amount}
        as="span"
        className="shrink-0 font-tech text-sm font-bold leading-none text-black"
      />
    ) : (
      <span className="shrink-0 font-tech text-[11px] font-bold uppercase tracking-widest text-success">
        {zeroLabel ?? 'Zadarmo'}
      </span>
    )}
  </label>
)

/**
 * Step 3 of the checkout — "Doprava a platba".
 *
 * Purely presentational: it reports the picked IDs upwards and never computes a
 * price the server will not re-derive (see src/payments/shared/fees.ts).
 */
export const DeliveryAndPayment: React.FC<Props> = ({
  disabled,
  onSelectPayment,
  onSelectShipping,
  paymentMethods,
  selectedPaymentID,
  selectedShippingID,
  shippingMethods,
}) => {
  return (
    <section className="rounded-default border border-gray-200 bg-white p-6 md:p-8">
      <h2 className="font-sans text-2xl font-bold tracking-tight text-black md:text-3xl">
        Doprava a platba
      </h2>
      <div className="section-decorator mt-4" />

      <div className="mt-8 flex flex-col gap-8">
        <div>
          <h3 className="form-label">Spôsob doručenia</h3>
          {shippingMethods.length === 0 ? (
            <p className="rounded-default bg-gray-50 p-4 font-sans text-sm text-gray-600">
              Momentálne nie je nastavený žiadny spôsob doručenia. Kontaktujte nás, prosím, a
              objednávku vybavíme osobne.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {shippingMethods.map((method) => (
                <MethodCard
                  amount={method.price ?? 0}
                  description={method.description}
                  disabled={disabled}
                  Icon={shippingIcons[method.type] ?? Truck}
                  key={method.id}
                  meta={method.deliveryEstimate}
                  name="shippingMethod"
                  onSelect={() => onSelectShipping(method.id)}
                  selected={selectedShippingID === method.id}
                  title={method.title}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="form-label">Spôsob platby</h3>
          {paymentMethods.length === 0 ? (
            <p className="rounded-default bg-gray-50 p-4 font-sans text-sm text-gray-600">
              Momentálne nie je nastavený žiadny spôsob platby.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {paymentMethods.map((method) => (
                <MethodCard
                  amount={method.surcharge ?? 0}
                  description={method.description}
                  disabled={disabled}
                  Icon={paymentIcons[method.type] ?? Banknote}
                  key={method.id}
                  name="paymentMethod"
                  onSelect={() => onSelectPayment(method.id)}
                  selected={selectedPaymentID === method.id}
                  title={method.title}
                  zeroLabel="Bez poplatku"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
