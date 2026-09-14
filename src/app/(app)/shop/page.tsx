import { ProductGridItem } from '@/components/ProductGridItem'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { PackageSearch } from 'lucide-react'

export const metadata = {
  description: 'Ručne pletené deky, hračky a prútené dekorácie pre útulný domov.',
  title: 'Obchod',
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/** "1 produkt" / "2–4 produkty" / "5+ produktov" — Slovak plural rules. */
function productCountLabel(count: number): string {
  if (count === 1) return '1 produkt'
  if (count >= 2 && count <= 4) return `${count} produkty`
  return `${count} produktov`
}

export default async function ShopPage({ searchParams }: Props) {
  const { q: searchValue, sort, category } = await searchParams
  const payload = await getPayload({ config: configPromise })

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      gallery: true,
      categories: true,
      priceInUSD: true,
      inventory: true,
      enableVariants: true,
    },
    ...(sort ? { sort } : { sort: 'title' }),
    ...(searchValue || category
      ? {
          where: {
            and: [
              {
                _status: {
                  equals: 'published',
                },
              },
              ...(searchValue
                ? [
                    {
                      or: [
                        {
                          title: {
                            like: searchValue,
                          },
                        },
                        {
                          description: {
                            like: searchValue,
                          },
                        },
                      ],
                    },
                  ]
                : []),
              ...(category
                ? [
                    {
                      categories: {
                        contains: category,
                      },
                    },
                  ]
                : []),
            ],
          },
        }
      : {}),
  })

  const hasResults = products?.docs.length > 0

  return (
    <div>
      {searchValue ? (
        <p className="mb-8 font-sans text-[13px] text-gray-600">
          {hasResults
            ? `Našli sme ${productCountLabel(products.docs.length)} pre `
            : 'Nenašli sme žiadny produkt pre '}
          <span className="font-bold text-black">&bdquo;{searchValue}&ldquo;</span>
        </p>
      ) : hasResults ? (
        <p className="mb-8 font-sans text-[13px] text-gray-600">
          {productCountLabel(products.docs.length)} v ponuke
        </p>
      ) : null}

      {hasResults ? (
        <div className="grid grid-cols-2 gap-x-1 gap-y-8 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {products.docs.map((product) => {
            return <ProductGridItem key={product.id} product={product} />
          })}
        </div>
      ) : (
        /* Empty-DB / no-match state — the storefront still has to read as a shop. */
        <div className="card-editorial flex flex-col items-center px-8 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
            <PackageSearch className="size-7" strokeWidth={1.5} />
          </span>
          <h2 className="mt-6 font-sans text-xl font-bold leading-snug text-black">
            Zatiaľ tu nič nie je
          </h2>
          <p className="mt-3 max-w-[420px] text-[13.5px] leading-[1.7] text-gray-700">
            {searchValue || category
              ? 'Skúste iné hľadanie alebo zrušte filtre — ponuku neustále dopĺňame o nové ručne pletené a prútené kúsky.'
              : 'Ponuku práve pripravujeme. Onedlho tu nájdete ručne pletené deky, hračky aj prútené dekorácie.'}
          </p>
          {(searchValue || category) && (
            <Link className="btn-primary mt-8" href="/shop">
              Zobraziť všetko
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
