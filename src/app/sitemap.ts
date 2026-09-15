/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * `/sitemap.xml` — zoznam skutočných, kanonických adries obchodu.
 *
 * Čo v ňom je: domovská stránka, `/shop`, `/blog`, každý publikovaný produkt,
 * každý publikovaný článok (`/blog/<slug>`), každá kategória
 * (`/kategoria/<slug>`) a každá publikovaná CMS stránka (tie majú vlastnú
 * routu `/[slug]`).
 *
 * Čo v ňom zámerne NIE JE: filtrované adresy typu `/shop?category=…`. Sú to tie
 * isté produkty pod iným parametrom — pre vyhľadávač duplicita, ktorá rozrieďuje
 * hodnotenie kanonických stránok. Od Z7 má kategória vlastnú kanonickú adresu
 * `/kategoria/<slug>`, takže do mapy ide tá, nie parameter.
 *
 * Databáza nemusí byť dostupná v čase buildu (CI bez dát), preto každý dopyt
 * padá do prázdneho zoznamu a mapa stránok sa aj tak vyrenderuje.
 */

/** Hodinu stará mapa stránok je pre vyhľadávače úplne v poriadku. */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getServerSideURL().replace(/\/$/, '')

  const entries: MetadataRoute.Sitemap = [
    {
      changeFrequency: 'weekly',
      lastModified: new Date(),
      priority: 1,
      url: `${baseUrl}/`,
    },
    {
      changeFrequency: 'daily',
      lastModified: new Date(),
      priority: 0.9,
      url: `${baseUrl}/shop`,
    },
    {
      changeFrequency: 'weekly',
      lastModified: new Date(),
      priority: 0.7,
      url: `${baseUrl}/blog`,
    },
  ]

  try {
    const payload = await getPayload({ config: configPromise })

    const [products, pages, posts, categories] = await Promise.all([
      payload.find({
        collection: 'products',
        depth: 0,
        draft: false,
        limit: 5000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      }),
      payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: 1000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      }),
      payload.find({
        collection: 'posts',
        depth: 0,
        draft: false,
        limit: 2000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      }),
      // Kategórie nemajú koncepty — každá existujúca kategória má živú stránku.
      payload.find({
        collection: 'categories',
        depth: 0,
        limit: 500,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
      }),
    ])

    for (const product of products.docs) {
      if (!product.slug) continue

      entries.push({
        changeFrequency: 'weekly',
        lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        priority: 0.8,
        url: `${baseUrl}/products/${product.slug}`,
      })
    }

    for (const post of posts.docs) {
      if (!post.slug) continue

      entries.push({
        changeFrequency: 'monthly',
        lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
        priority: 0.6,
        url: `${baseUrl}/blog/${post.slug}`,
      })
    }

    for (const category of categories.docs) {
      if (!category.slug) continue

      entries.push({
        changeFrequency: 'weekly',
        lastModified: category.updatedAt ? new Date(category.updatedAt) : new Date(),
        priority: 0.7,
        url: `${baseUrl}/kategoria/${category.slug}`,
      })
    }

    for (const page of pages.docs) {
      // `home` je domovská stránka, tá už v zozname je pod `/`.
      if (!page.slug || page.slug === 'home') continue

      entries.push({
        changeFrequency: 'monthly',
        lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
        priority: 0.5,
        url: `${baseUrl}/${page.slug}`,
      })
    }
  } catch {
    // Prázdna alebo nedostupná databáza nesmie zhodiť build ani požiadavku —
    // mapa sa vráti aspoň so statickými adresami.
  }

  return entries
}
