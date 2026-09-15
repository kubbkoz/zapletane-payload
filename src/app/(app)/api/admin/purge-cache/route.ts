import configPromise from '@payload-config'
import { revalidatePath, revalidateTag } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * „Vymazať cache webu" — ručné kladivo na celú Next cache.
 *
 * Zmaže dátovú cache (všetky tagy, pod ktorými storefront číta CMS obsah) aj
 * FULL ROUTE CACHE celého (app) stromu (`revalidatePath('/', 'layout')`), takže
 * najbližšia požiadavka na každú stránku sa vyrenderuje nanovo z čerstvých dát.
 *
 * Existuje preto, lebo staticky predrenderovaná stránka sa servíruje z CDN bez
 * spustenia layoutu — zmena v CMS sa na nej neprejaví, kým sa route cache
 * nezneplatní (presne to sa stalo prepínaču Coming soon). Bežné uloženia si
 * cache čistia samy cez afterChange hooky; toto tlačidlo je pre istotu a pre
 * prípady, ktoré hook nepokryje.
 */

const TAGS = [
  'global_site-settings',
  'global_header',
  'global_footer',
  'global_homepage',
  'global_feed-settings',
  'feeds',
  'redirects',
  'product-filters',
  'admin-stats',
]

export async function POST(request: Request): Promise<NextResponse> {
  const payload = await getPayload({ config: configPromise })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user || !('roles' in user) || !checkRole(['admin'], user)) {
    return NextResponse.json(
      { message: 'Len pre prihláseného administrátora.', ok: false },
      { status: 401 },
    )
  }

  for (const tag of TAGS) revalidateTag(tag, 'max')
  revalidatePath('/', 'layout')

  payload.logger.info(`[purge-cache] Cache zmazaná používateľom ${user.email ?? user.id}.`)

  return NextResponse.json({ ok: true, purgedTags: TAGS, routeCache: true })
}
