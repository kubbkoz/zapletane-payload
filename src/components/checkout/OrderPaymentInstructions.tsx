import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { Banknote, CreditCard, Landmark } from 'lucide-react'

import type { Order, PaymentMethod } from '@/payload-types'

import { RichText } from '@/components/RichText'
import { Price } from '@/components/Price'
import { getSiteSettings } from '@/utilities/getSiteSettings'

/**
 * Post-order payment instructions shown on the order detail / confirmation
 * page.
 *
 *   - `bankTransfer` -> the shop's bank details from Site Settings, with the
 *     amount to send and the order number as the variabilný symbol.
 *   - `cod`          -> "Zaplatíte pri prevzatí".
 *   - `card`         -> a short paid confirmation.
 *
 * Any free-form copy the shop maintains on the matching `payment-methods` row
 * (`instructions`) is rendered underneath. The order stores only `paymentType`,
 * so the row is resolved by type — enough for a shop with one row per type,
 * which is what the seed creates.
 */

const loadInstructions = async (
  paymentType: NonNullable<Order['paymentType']>,
): Promise<PaymentMethod | null> => {
  try {
    const payload = await getPayload({ config: configPromise })

    const { docs } = await payload.find({
      collection: 'payment-methods',
      depth: 0,
      limit: 1,
      sort: 'sortOrder',
      where: { type: { equals: paymentType } },
    })

    return docs[0] ?? null
  } catch {
    return null
  }
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ children, label }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-brand-200/60 py-2 last:border-b-0">
    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
    <span className="font-tech text-sm font-bold text-black">{children}</span>
  </div>
)

export const OrderPaymentInstructions: React.FC<{ order: Order }> = async ({ order }) => {
  const paymentType = order.paymentType

  if (!paymentType) {
    return null
  }

  const [settings, method] = await Promise.all([
    getSiteSettings(),
    loadInstructions(paymentType),
  ])

  const bank = settings?.payments
  const showBankDetails = paymentType === 'bankTransfer' && Boolean(bank?.iban)

  const Icon =
    paymentType === 'bankTransfer' ? Landmark : paymentType === 'cod' ? Banknote : CreditCard

  const heading =
    paymentType === 'bankTransfer'
      ? 'Platobné pokyny'
      : paymentType === 'cod'
        ? 'Platba dobierkou'
        : 'Platba kartou'

  const lede =
    paymentType === 'bankTransfer'
      ? 'Prosíme o úhradu na nasledujúci účet. Tovar expedujeme po pripísaní platby.'
      : paymentType === 'cod'
        ? 'Zaplatíte pri prevzatí zásielky — kuriérovi alebo na výdajnom mieste.'
        : 'Platba kartou bola spracovaná platobnou bránou.'

  return (
    <div className="rounded-default border border-brand-200 bg-brand-50 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <h2 className="font-sans text-lg font-bold tracking-tight text-black">{heading}</h2>
      </div>

      <p className="mt-3 font-sans text-[13.5px] leading-[1.7] text-gray-700">{lede}</p>

      {showBankDetails && (
        <div className="mt-6 rounded-default bg-white p-4 md:p-5">
          {bank?.bankAccountHolder && <Row label="Príjemca">{bank.bankAccountHolder}</Row>}
          <Row label="IBAN">{bank?.iban}</Row>
          {bank?.swift && <Row label="SWIFT / BIC">{bank.swift}</Row>}
          {bank?.bankName && <Row label="Banka">{bank.bankName}</Row>}
          <Row label="Variabilný symbol">{order.id}</Row>
          <Row label="Suma">
            {typeof order.amount === 'number' ? (
              <Price
                amount={order.amount}
                as="span"
                currencyCode={order.currency ?? undefined}
                className="font-tech text-sm font-bold text-black"
              />
            ) : (
              '—'
            )}
          </Row>
        </div>
      )}

      {paymentType === 'bankTransfer' && bank?.variableSymbolNote && (
        <p className="mt-4 font-sans text-[13px] leading-relaxed text-gray-600">
          {bank.variableSymbolNote}
        </p>
      )}

      {paymentType === 'bankTransfer' && !showBankDetails && (
        <p className="mt-4 font-sans text-[13px] leading-relaxed text-gray-600">
          Platobné údaje vám pošleme e-mailom — bankové spojenie zatiaľ nie je vyplnené v
          Nastaveniach webu.
        </p>
      )}

      {method?.instructions && (
        <div className="prose prose-sm mt-6 max-w-none text-gray-700">
          <RichText data={method.instructions} enableGutter={false} />
        </div>
      )}
    </div>
  )
}
