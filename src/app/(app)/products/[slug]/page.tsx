import type { Media, Product } from '@/payload-types'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { Gallery } from '@/components/product/Gallery'
import { ProductDescription } from '@/components/product/ProductDescription'
import { ProductProperties } from '@/components/products/ProductProperties'
import { ProductRail } from '@/components/products/ProductRail'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { Suspense } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { Metadata } from 'next'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const gallery = product.gallery?.filter((item) => typeof item.image === 'object') || []

  const metaImage = typeof product.meta?.image === 'object' ? product.meta?.image : undefined
  const canIndex = product._status === 'published'

  const seoImage = metaImage || (gallery.length ? (gallery[0]?.image as Media) : undefined)

  return {
    description: product.meta?.description || '',
    openGraph: seoImage?.url
      ? {
          images: [
            {
              alt: seoImage?.alt,
              height: seoImage.height!,
              url: seoImage?.url,
              width: seoImage.width!,
            },
          ],
        }
      : null,
    robots: {
      follow: canIndex,
      googleBot: {
        follow: canIndex,
        index: canIndex,
      },
      index: canIndex,
    },
    title: product.meta?.title || product.title,
  }
}

export default async function ProductPage({ params }: Args) {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const gallery =
    product.gallery
      ?.filter((item) => typeof item.image === 'object')
      .map((item) => ({
        ...item,
        image: item.image as Media,
      })) || []

  const metaImage = typeof product.meta?.image === 'object' ? product.meta?.image : undefined
  const hasStock = product.enableVariants
    ? product?.variants?.docs?.some((variant) => {
        if (typeof variant !== 'object') return false
        return variant.inventory && variant?.inventory > 0
      })
    : product.inventory! > 0

  let price = product.priceInEUR

  if (product.enableVariants && product?.variants?.docs?.length) {
    price = product?.variants?.docs?.reduce((acc, variant) => {
      if (typeof variant === 'object' && variant?.priceInEUR && acc && variant?.priceInEUR > acc) {
        return variant.priceInEUR
      }
      return acc
    }, price)
  }

  const productJsonLd = {
    name: product.title,
    '@context': 'https://schema.org',
    '@type': 'Product',
    description: product.description,
    image: metaImage?.url,
    offers: {
      '@type': 'AggregateOffer',
      availability: hasStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      price: price,
      priceCurrency: 'usd',
    },
  }

  const upsellProducts =
    product.upsell?.filter((upsellProduct) => typeof upsellProduct === 'object') ?? []

  const relatedProducts =
    product.relatedProducts?.filter((relatedProduct) => typeof relatedProduct === 'object') ?? []

  return (
    <React.Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
        type="application/ld+json"
      />
      <div className="bg-brand-50">
        <div className="container-editorial pb-16 pt-8 lg:pb-24">
          <Link
            className="inline-flex items-center gap-1 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-brand"
            href="/shop"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Všetky produkty
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
            <div className="h-full w-full">
              <Suspense
                fallback={
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-gray-50" />
                }
              >
                {Boolean(gallery?.length) ? (
                  <Gallery gallery={gallery} />
                ) : (
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-gray-100" />
                )}
              </Suspense>
            </div>

            <div className="lg:pt-2">
              <ProductDescription product={product} />
            </div>
          </div>
        </div>
      </div>

      <ProductProperties product={product} />

      {product.layout?.length ? <RenderBlocks blocks={product.layout} /> : <></>}

      <ProductRail
        eyebrow="Odporúčame"
        heading={
          <>
            Mohlo by vás <span className="text-brand">zaujať</span>
          </>
        }
        products={upsellProducts as Product[]}
      />

      <ProductRail
        eyebrow="Z tej istej dielne"
        heading="Súvisiace produkty"
        products={relatedProducts as Product[]}
      />
    </React.Fragment>
  )
}

const queryProductBySlug = async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    depth: 3,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
    populate: {
      variants: {
        title: true,
        priceInEUR: true,
        inventory: true,
        options: true,
      },
    },
  })

  return result.docs?.[0] || null
}
