'use client'

import type { Product } from '@/payload-types'

import { createUrl } from '@/utilities/createUrl'
import { cn } from '@/utilities/cn'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

/**
 * PDP variant chip selector — DESIGN-SPEC §3.3:
 * `min-w-[3.5rem] w-auto px-4 h-12 flex items-center justify-center font-bold
 *  text-sm border font-sans focus:ring-1 focus:ring-black rounded-sm`
 *
 * Stock colouring follows the card's chip language: selected = filled brand,
 * available = quiet gray border that warms to brand on hover, sold out = grayed
 * with the same inline-SVG diagonal strike (stroke #E4D2CB) used everywhere else.
 * All routing/param logic below is unchanged from the template.
 */
export function VariantSelector({ product }: { product: Product }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const variants = product.variants?.docs
  const variantTypes = product.variantTypes
  const hasVariants = Boolean(product.enableVariants && variants?.length && variantTypes?.length)

  if (!hasVariants) {
    return null
  }

  return variantTypes?.map((type) => {
    if (!type || typeof type !== 'object') {
      return <></>
    }

    const options = type.options?.docs

    if (!options || !Array.isArray(options) || !options.length) {
      return <></>
    }

    return (
      <dl className="flex flex-col" key={type.id}>
        <dt className="form-label">{type.label}</dt>
        <dd className="flex flex-wrap gap-2">
          <React.Fragment>
            {options?.map((option) => {
              if (!option || typeof option !== 'object') {
                return <></>
              }

              const optionID = option.id
              const optionKeyLowerCase = type.name

              // Base option params on current params so we can preserve any other param state in the url.
              const optionSearchParams = new URLSearchParams(searchParams.toString())

              // Remove image and variant ID from this search params so we can loop over it safely.
              optionSearchParams.delete('variant')
              optionSearchParams.delete('image')

              // Update the option params using the current option to reflect how the url *would* change,
              // if the option was clicked.
              optionSearchParams.set(optionKeyLowerCase, String(optionID))

              const currentOptions = Array.from(optionSearchParams.values())

              let isAvailableForSale = true

              // Find a matching variant
              if (variants) {
                const matchingVariant = variants
                  .filter((variant) => typeof variant === 'object')
                  .find((variant) => {
                    if (!variant.options || !Array.isArray(variant.options)) return false

                    // Check if all variant options match the current options in the URL
                    return variant.options.every((variantOption) => {
                      if (typeof variantOption !== 'object')
                        return currentOptions.includes(String(variantOption))

                      return currentOptions.includes(String(variantOption.id))
                    })
                  })

                if (matchingVariant) {
                  // If we found a matching variant, set the variant ID in the search params.
                  optionSearchParams.set('variant', String(matchingVariant.id))

                  if (matchingVariant.inventory && matchingVariant.inventory > 0) {
                    isAvailableForSale = true
                  } else {
                    isAvailableForSale = false
                  }
                }
              }

              const optionUrl = createUrl(pathname, optionSearchParams)

              // The option is active if it's in the url params.
              const isActive =
                Boolean(isAvailableForSale) &&
                searchParams.get(optionKeyLowerCase) === String(optionID)

              return (
                <button
                  aria-disabled={!isAvailableForSale}
                  className={cn(
                    'relative flex h-12 w-auto min-w-[3.5rem] items-center justify-center rounded-sm border px-4 font-sans text-sm font-bold transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-black',
                    isActive && 'border-brand bg-brand text-white',
                    !isActive &&
                      isAvailableForSale &&
                      'border-gray-200 bg-white text-black hover:border-brand hover:text-brand',
                    !isAvailableForSale &&
                      'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60',
                  )}
                  disabled={!isAvailableForSale}
                  key={option.id}
                  onClick={() => {
                    router.replace(`${optionUrl}`, {
                      scroll: false,
                    })
                  }}
                  title={`${option.label}${!isAvailableForSale ? ' (Vypredané)' : ''}`}
                  type="button"
                >
                  {option.label}
                  {!isAvailableForSale && (
                    <span className="pointer-events-none absolute inset-0 overflow-hidden">
                      <svg className="h-full w-full" preserveAspectRatio="none">
                        <line x1="0" y1="100%" x2="100%" y2="0" stroke="#E4D2CB" strokeWidth="1" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </React.Fragment>
        </dd>
      </dl>
    )
  })
}
