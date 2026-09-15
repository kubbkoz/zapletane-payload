/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * `/robots.txt`.
 *
 * Katalóg (`/shop`, `/products/*`) a obsahové stránky sú otvorené — to je to,
 * čo má byť v indexe aj v odpovediach generatívnych vyhľadávačov. Zavreté sú
 * len cesty, ktoré v indexe nemajú čo robiť: administrácia, API, pokladňa,
 * zákaznícky účet a prihlasovacie obrazovky. Sú to buď súkromné stránky, alebo
 * jednorazové kroky bez vlastného obsahu.
 *
 * Adresa sa berie z `NEXT_PUBLIC_SERVER_URL` (rovnaký zdroj ako kanonické URL
 * a mapa stránok), takže sa nemôže rozísť so zvyškom webu.
 *
 * Pozn.: kým beží predspustenie (`COMING_SOON_BYPASS`), celý web odpovedá
 * uvítacou stránkou a robots.txt je statický — o tom, čo sa reálne indexuje,
 * rozhoduje tá brána, nie tento súbor.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getServerSideURL().replace(/\/$/, '')

  return {
    host: baseUrl,
    rules: [
      {
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/next/',
          '/checkout',
          '/account',
          '/orders',
          '/login',
          '/logout',
          '/create-account',
          '/forgot-password',
          '/find-order',
        ],
        userAgent: '*',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
