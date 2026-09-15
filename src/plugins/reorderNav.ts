import type { Config, Plugin } from 'payload'

/**
 * Poradie položiek v bočnej navigácii admina (Z8).
 *
 * Payload 3.89 nemá „order“ ani „weight“ pre položku menu. `DefaultNav`
 * (@payloadcms/next/dist/elements/Nav/index.js) skladá zoznam takto:
 *
 *   groupNavItems([...config.collections, ...config.globals], …)
 *
 * a `groupNavItems` (@payloadcms/ui/dist/utilities/groupNavItems.js) len
 * prechádza tým poľom a strká položky do skupín v poradí, v akom prišli. Poradie
 * v skupine „Ecommerce“ je teda doslova poradie v `config.collections`.
 *
 * Kolekcie tejto skupiny pridáva `ecommercePlugin`, takže ich poradie nevieme
 * ovplyvniť v `payload.config.ts` — preto toto post-processing plugin, ktorý sa
 * púšťa AKO POSLEDNÝ (`src/plugins/index.ts`), keď je už `orders` v poli.
 *
 * Mení sa výhradne poradie prvkov poľa. Payload aj relačné polia adresujú
 * kolekcie slugom, nie indexom, takže presun je pre zvyšok configu neviditeľný;
 * jediné, čo z neho vidno, je menu.
 */

/** Slugy, ktoré majú byť v navigácii prvé, v tomto poradí. */
const NAV_FIRST: string[] = ['orders']

export const reorderNav: Plugin = (config: Config): Config => {
  const collections = config.collections

  if (!collections?.length) return config

  const promoted = NAV_FIRST.map((slug) =>
    collections.find((collection) => collection.slug === slug),
  ).filter((collection): collection is NonNullable<typeof collection> => Boolean(collection))

  if (promoted.length === 0) return config

  return {
    ...config,
    collections: [
      ...promoted,
      ...collections.filter((collection) => !promoted.includes(collection)),
    ],
  }
}
