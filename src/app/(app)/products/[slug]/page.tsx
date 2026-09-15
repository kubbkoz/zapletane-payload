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
import React, { cache, Suspense } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { Metadata } from 'next'

import { JsonLd } from '@/seo/JsonLd'
import { buildTemplateMeta } from '@/seo/generate'
import { buildBreadcrumbJsonLd, buildProductJsonLd, productImages } from '@/seo/jsonLd'
import { toSeoProductInput } from '@/seo/productInput'
import { getServerSideURL } from '@/utilities/getURL'

const SITE_NAME = process.env.SITE_NAME || 'ZAPLETANE'

type Args = {
  params: Promise<{
    slug: string
  }>
}

/**
 * Meta pre stránku produktu (Z4).
 *
 * Zdrojom sú uložené `meta.*` polia — tie vznikajú automaticky pri ukladaní
 * produktu (hook v kolekcii). Ak by predsa len chýbali (starý záznam, import,
 * produkt uložený mimo hooku), poskladá sa tu tá istá slovenská šablóna —
 * synchrónne a bez siete, aby vykreslenie stránky nikdy nečakalo na AI.
 */
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const siteUrl = getServerSideURL().replace(/\/$/, '')
  const url = `${siteUrl}/products/${product.slug}`
  const fallback = buildTemplateMeta(await toSeoProductInput(product))

  const title = product.meta?.title?.trim() || fallback.metaTitle
  const description = product.meta?.description?.trim() || fallback.metaDescription

  const images = productImages(product, siteUrl).map((image) => ({
    alt: product.title,
    url: image,
  }))

  // Koncept sa nesmie dostať do indexu, aj keď je cez preview verejne dostupný.
  const canIndex = product._status === 'published'

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      description,
      images,
      locale: 'sk_SK',
      siteName: SITE_NAME,
      title,
      type: 'website',
      url,
    },
    robots: {
      follow: canIndex,
      googleBot: {
        follow: canIndex,
        index: canIndex,
      },
      index: canIndex,
    },
    // `absolute`, lebo koreňový layout pridáva šablónu „%s | ZAPLETANE" a meta
    // titulok značku už obsahuje — inak by v `<title>` bola dvakrát.
    title: { absolute: title },
    twitter: {
      card: 'summary_large_image',
      description,
      images: images.map((image) => image.url),
      title,
    },
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

  // Štruktúrované dáta (SEO + GEO): `Product` so všetkými faktami, ktoré o
  // produkte vieme, a `BreadcrumbList` s cestou Domov → Obchod → produkt.
  const siteUrl = getServerSideURL()
  const productJsonLd = buildProductJsonLd(product, siteUrl)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(product, siteUrl)

  const upsellProducts =
    product.upsell?.filter((upsellProduct) => typeof upsellProduct === 'object') ?? []

  const relatedProducts =
    product.relatedProducts?.filter((relatedProduct) => typeof relatedProduct === 'object') ?? []

  return (
    <React.Fragment>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
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
                  // Náhradný `alt` pre fotky bez popisu v médiách (Z4).
                  <Gallery alt={product.title} gallery={gallery} />
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

/**
 * `cache()` = jeden dopyt na request: `generateMetadata` aj samotná stránka
 * potrebujú ten istý produkt, React im vráti ten istý výsledok.
 */
const queryProductBySlug = cache(async ({ slug }: { slug: string }) => {
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
})
