import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import { Product, Variant } from '@/payload-types'
import Link from 'next/link'

type Props = {
  product: Product
  style?: 'compact' | 'default'
  variant?: Variant
  quantity?: number
  /**
   * Force all formatting to a particular currency.
   */
  currencyCode?: string
}

/**
 * Order / summary line item. Same visual grammar as the cart drawer row: cream
 * photo stage with `mix-blend-multiply`, DM Sans title that warms to brand on
 * hover, option chips, `font-tech` price. Slovak labels per DESIGN-SPEC §5.
 */
export const ProductItem: React.FC<Props> = ({
  product,
  style = 'default',
  quantity,
  variant,
  currencyCode,
}) => {
  const { title } = product

  const metaImage =
    product.meta?.image && typeof product.meta?.image !== 'string' ? product.meta.image : undefined

  const firstGalleryImage =
    typeof product.gallery?.[0]?.image !== 'string' ? product.gallery?.[0]?.image : undefined

  let image = firstGalleryImage || metaImage

  const isVariant = Boolean(variant) && typeof variant === 'object'

  if (isVariant) {
    const imageVariant = product.gallery?.find((item) => {
      if (!item.variantOption) return false
      const variantOptionID =
        typeof item.variantOption === 'object' ? item.variantOption.id : item.variantOption

      const hasMatch = variant?.options?.some((option) => {
        if (typeof option === 'object') return option.id === variantOptionID
        else return option === variantOptionID
      })

      return hasMatch
    })

    if (imageVariant && typeof imageVariant.image !== 'string') {
      image = imageVariant.image
    }
  }

  const itemPrice = variant?.priceInUSD || product.priceInUSD
  const itemURL = `/products/${product.slug}${variant ? `?variant=${variant.id}` : ''}`

  return (
    <div className="flex items-start gap-4">
      <Link
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-gray-100 bg-gray-50"
        href={itemURL}
      >
        {image && typeof image !== 'string' && (
          <Media
            className="h-full w-full"
            fill
            imgClassName="object-contain p-2 mix-blend-multiply"
            resource={image}
          />
        )}
      </Link>

      <div className="flex grow flex-col gap-1">
        <Link
          className="font-sans text-sm font-medium leading-snug text-black transition-colors hover:text-brand"
          href={itemURL}
        >
          {title}
        </Link>

        {variant && (
          <div className="flex flex-wrap gap-1">
            {variant.options?.map((option, index) => {
              if (typeof option !== 'object') return null
              return (
                <span
                  className="inline-flex items-center rounded-sm border border-gray-200 bg-white px-1.5 py-0.5 font-tech text-[10px] font-bold uppercase tracking-wider text-gray-600"
                  key={index}
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

      {itemPrice && quantity && (
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Medzisúčet</p>
          <Price
            amount={itemPrice * quantity}
            as="span"
            className="font-tech text-base font-bold leading-none text-black"
            currencyCode={currencyCode}
          />
        </div>
      )}
    </div>
  )
}
