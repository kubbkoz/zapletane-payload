'use client'
import type { Product, Variant } from '@/payload-types'

import { RichText } from '@/components/RichText'
import { Price } from '@/components/Price'
import React, { Suspense } from 'react'
import { Hand, Leaf, Truck } from 'lucide-react'

import { VariantSelector } from './VariantSelector'
import { useCurrency } from '@payloadcms/plugin-ecommerce/client/react'
import { PurchasePanel } from '@/components/product/PurchasePanel'

/**
 * PDP information column.
 *
 * H1 follows the documented ZAPLETANE heading hierarchy (DESIGN-SPEC §1.2):
 * `font-sans` (DM Sans) overriding the global Unbounded h1 rule, normal-case,
 * tracking-tight — NOT the uppercase/font-tech leftover that the shipped
 * ProductInfo.vue still carries and that §9.1 flags as unintentional.
 * Price is `font-tech font-black` per §3.3, and the perk row under the CTA
 * repeats the hero's three brand pillars so the promise is restated at the
 * point of purchase.
 *
 * Purchase panel order (Z18 redesign): price → variant selector (untouched)
 * → `PurchasePanel` (stock counter → quantity stepper → add-to-cart +
 * wishlist row → Google Pay express button, the last gated behind
 * `cardPaymentEnabled` resolved server-side in `products/[slug]/page.tsx`).
 */

const PERKS = [
  { icon: Hand, label: 'Ručná výroba' },
  { icon: Leaf, label: 'Prírodné materiály' },
  { icon: Truck, label: 'Doručenie do 3 dní' },
]

type Props = {
  /** Server-resolved (Z18): does an enabled `payment-methods` row of type `card` exist? */
  cardPaymentEnabled?: boolean
  product: Product
}

export function ProductDescription({ cardPaymentEnabled = false, product }: Props) {
  const { currency } = useCurrency()
  let amount = 0,
    lowestAmount = 0,
    highestAmount = 0
  const priceField = `priceIn${currency.code}` as keyof Product
  const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)

  if (hasVariants) {
    const priceField = `priceIn${currency.code}` as keyof Variant
    const variantsOrderedByPrice = product.variants?.docs
      ?.filter((variant) => variant && typeof variant === 'object')
      .sort((a, b) => {
        if (
          typeof a === 'object' &&
          typeof b === 'object' &&
          priceField in a &&
          priceField in b &&
          typeof a[priceField] === 'number' &&
          typeof b[priceField] === 'number'
        ) {
          return a[priceField] - b[priceField]
        }

        return 0
      }) as Variant[]

    const lowestVariant = variantsOrderedByPrice[0][priceField]
    const highestVariant = variantsOrderedByPrice[variantsOrderedByPrice.length - 1][priceField]
    if (
      variantsOrderedByPrice &&
      typeof lowestVariant === 'number' &&
      typeof highestVariant === 'number'
    ) {
      lowestAmount = lowestVariant
      highestAmount = highestVariant
    }
  } else if (product[priceField] && typeof product[priceField] === 'number') {
    amount = product[priceField]
  }

  return (
    <div className="flex flex-col">
      <p className="eyebrow">Ručná výroba</p>

      <h1 className="mt-4 font-sans text-3xl font-bold leading-tight tracking-tight text-black md:text-5xl">
        {product.title}
      </h1>

      <div className="section-decorator mt-6" />

      <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
        {hasVariants ? (
          <Price
            as="span"
            className="font-tech text-2xl font-black leading-none text-black md:text-4xl"
            highestAmount={highestAmount}
            lowestAmount={lowestAmount}
          />
        ) : (
          <Price
            amount={amount}
            as="span"
            className="font-tech text-2xl font-black leading-none text-black md:text-4xl"
          />
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          vrátane DPH
        </span>
      </div>

      {product.description ? (
        <RichText
          className="mt-7 max-w-[520px] font-sans text-sm leading-relaxed text-gray-600 md:text-base"
          data={product.description}
          enableGutter={false}
          enableHeadingMark
        />
      ) : null}

      {hasVariants && (
        <div className="mt-8 border-t border-gray-200 pt-8">
          <Suspense fallback={null}>
            <VariantSelector product={product} />
          </Suspense>
        </div>
      )}

      <div className="mt-8">
        <Suspense fallback={null}>
          <PurchasePanel cardPaymentEnabled={cardPaymentEnabled} product={product} />
        </Suspense>
      </div>

      <ul className="mt-10 flex flex-wrap gap-x-9 gap-y-6 border-t border-gray-200 pt-8">
        {PERKS.map((perk) => (
          <li className="flex w-[92px] flex-col items-center text-center" key={perk.label}>
            <perk.icon className="size-8 text-brand" strokeWidth={1.4} />
            <span className="mt-3 text-[12px] leading-snug text-gray-700">{perk.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
