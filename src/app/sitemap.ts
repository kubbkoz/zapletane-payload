/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * `/sitemap.xml` — zoznam skutočných, kanonických adries obchodu.
 *
 * Čo v ňom je: domovská stránka, `/shop`, každý publikovaný produkt a každá
 * publikovaná CMS stránka (tie majú vlastnú routu `/[slug]`).
 *
 * Čo v ňom zámerne NIE JE: filtrované adresy typu `/shop?category=…`. Sú to tie
 * isté produkty pod iným parametrom — pre vyhľadávač duplicita, ktorá rozrieďuje
 * hodnotenie kanonických stránok. Kategórie nemajú vlastnú routu, takže by ani
 * nebolo kam odkazovať.
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
  ]

  try {
    const payload = await getPayload({ config: configPromise })

    const [products, pages] = await Promise.all([
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
