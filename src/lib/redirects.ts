import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { revalidateTag, unstable_cache } from 'next/cache'

/**
 * Presmerovania po zmene adresy (Z7).
 *
 * Adresa produktu, článku, stránky aj kategórie sa odvodzuje od názvu
 * (`src/fields/slug`). Keď majiteľka názov prepíše, adresa sa zmení — lenže
 * stará už môže byť zaindexovaná v Google, poslaná v newsletteri alebo
 * uložená v záložkách. Preto pri každej zmene adresy vznikne 301 z tej starej
 * na tú novú, úplne automaticky.
 *
 * Kde sa presmerovania ukladajú: v kolekcii `redirects` z oficiálneho
 * `@payloadcms/plugin-redirects` (registruje ju `src/plugins/index.ts`), takže
 * sa dajú aj ručne dopísať, upraviť či zmazať v admine.
 *
 * Tri pravidlá, ktoré držia zoznam čistý:
 *   1. **Skracovanie reťazcov.** A→B a potom B→C neznamená dva skoky —
 *      záznam A sa prepíše rovno na C. Vyhľadávače viacnásobné skoky nemajú
 *      rady a pri každom sa stráca časť „sily" odkazu.
 *   2. **Žiadne slučky.** Ak sa adresa vráti na starú hodnotu, záznam, ktorý
 *      by ukazoval sám na seba (alebo dozadu), sa zmaže.
 *   3. **Nič z konceptov.** Kým dokument nebol publikovaný, žiadna verejná
 *      adresa neexistovala — takže sa ani nemá čo presmerovávať.
 */

/** Cache tag, ktorý drží prečítanú tabuľku presmerovaní v pamäti Next.js. */
export const REDIRECTS_TAG = 'redirects'

/** Kolekcie, ktoré majú vlastnú verejnú adresu odvodenú od `slug`. */
export const REDIRECT_COLLECTIONS = ['pages', 'posts', 'products', 'categories'] as const

export type RedirectCollection = (typeof REDIRECT_COLLECTIONS)[number]

/**
 * Verejná adresa dokumentu — jediné miesto, kde je napísané, že článok žije na
 * `/blog/<slug>` a kategória na `/kategoria/<slug>`.
 */
export const publicPathFor = (collection: RedirectCollection | string, slug: string): null | string => {
  if (!slug) return null

  switch (collection) {
    case 'categories':
      return `/kategoria/${slug}`
    case 'pages':
      return slug === 'home' ? '/' : `/${slug}`
    case 'posts':
      return `/blog/${slug}`
    case 'products':
      return `/products/${slug}`
    default:
      return null
  }
}

/** `/blog/nieco/` aj `/blog/nieco?x=1` sú tá istá adresa ako `/blog/nieco`. */
export const normalizePath = (pathname: string): string => {
  if (!pathname) return '/'

  const withoutQuery = pathname.split('?')[0].split('#')[0]
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const trimmed = withLeadingSlash.replace(/\/+$/, '')

  return trimmed === '' ? '/' : trimmed
}

type RedirectReference = {
  relationTo?: string
  value?: number | string | { slug?: null | string }
}

type RedirectDoc = {
  from?: null | string
  id: number | string
  to?: null | {
    reference?: null | RedirectReference
    type?: null | string
    url?: null | string
  }
}

/** Cieľ presmerovania ako cesta — buď ručne napísaná, alebo z odkazu na dokument. */
const targetPath = (doc: RedirectDoc): null | string => {
  const to = doc.to

  if (!to) return null

  if (to.type === 'reference') {
    const reference = to.reference

    if (!reference || typeof reference.value !== 'object' || reference.value === null) return null

    const slug = reference.value.slug

    if (!slug || !reference.relationTo) return null

    return publicPathFor(reference.relationTo, slug)
  }

  return to.url ? normalizePath(to.url) : null
}

/**
 * Celá tabuľka presmerovaní ako mapa `stará cesta → nová cesta`.
 *
 * Číta sa naraz a drží sa v cache, lebo sa na ňu pýta každá 404 — a je to
 * krátky zoznam (rádovo desiatky riadkov), nie katalóg. Cache vyprázdni
 * `revalidateRedirects` pri každej zmene v kolekcii; päťminútový strop je
 * poistka pre zápisy mimo požiadavky (migrácia, seed), kde `revalidateTag`
 * nemá kde bežať.
 */
const readRedirectMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const map: Record<string, string> = {}

    try {
      const payload = await getStandalonePayload()

      const result = await payload.find({
        collection: 'redirects',
        depth: 1,
        limit: 5000,
        overrideAccess: true,
        pagination: false,
      })

      for (const raw of result.docs as unknown as RedirectDoc[]) {
        const from = raw.from ? normalizePath(raw.from) : null
        const to = targetPath(raw)

        if (!from || !to || from === to) continue

        map[from] = to
      }
    } catch {
      // Prázdna alebo nedostupná databáza nesmie spôsobiť chybu stránky —
      // bez mapy sa jednoducho zobrazí 404, presne ako predtým.
    }

    return map
  },
  ['zapletane-redirect-map'],
  { revalidate: 300, tags: [REDIRECTS_TAG] },
)

const getStandalonePayload = async () => {
  const { default: configPromise } = await import('@payload-config')
  const { getPayload } = await import('payload')

  return getPayload({ config: configPromise })
}

/**
 * Jedno presmerovanie načítané priamo, mimo cache.
 *
 * Prečo to vôbec je: presmerovanie vzniká v `afterChange` hooku dokumentu,
 * teda *vnútri* databázovej transakcie, kým `revalidateTag` sa vykoná hneď.
 * Požiadavka, ktorá trafí ten zlomok sekundy medzi vyprázdnením cache a
 * potvrdením transakcie, by si do cache uložila mapu ešte bez nového riadku —
 * a návštevník by dostával 404 až do vypršania stropu. Priame dočítanie tú
 * dieru zatvára.
 *
 * Cena je nulová: sem sa program dostane iba na ceste, ktorá by inak skončila
 * 404-kou, a `from` je unikátne indexovaný stĺpec.
 */
const readRedirectDirect = async (from: string): Promise<null | string> => {
  try {
    const payload = await getStandalonePayload()

    const result = await payload.find({
      collection: 'redirects',
      depth: 1,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { from: { equals: from } },
    })

    const doc = result.docs[0] as unknown as RedirectDoc | undefined

    return doc ? targetPath(doc) : null
  } catch {
    return null
  }
}

/** Najviac toľko skokov prejde rozuzľovač, než to vzdá. */
const MAX_CHAIN_HOPS = 10

/**
 * Nájde cieľ pre danú adresu. Vracia `null`, keď presmerovanie neexistuje —
 * volajúci potom pokračuje na `notFound()`.
 *
 * Reťazce, ktoré by aj tak nemali vzniknúť (`upsertSlugRedirect` ich skracuje),
 * sa tu ešte raz prejdú do hĺbky, aby jedna zabudnutá ručná úprava v admine
 * neposlala návštevníka na ďalšiu 404.
 */
export const resolveRedirect = async (pathname: string): Promise<null | string> => {
  const map = await readRedirectMap()
  const start = normalizePath(pathname)

  // Mapa je rýchla cesta, priame dočítanie je poistka proti tomu, že vznikla
  // o zlomok sekundy skôr, než sa nový riadok stihol potvrdiť v transakcii.
  const lookup = async (path: string): Promise<null | string> =>
    map[path] ?? (await readRedirectDirect(path))

  const first = await lookup(start)

  if (!first) return null

  let target: string = first
  const seen = new Set<string>([start])

  // Rovnaké `lookup` aj pri ďalších skokoch — inak by sa reťazec dopísaný
  // ručne v admine rozuzľoval po jednom presmerovaní na požiadavku, a
  // návštevník (aj vyhľadávač) by prešiel dvoma 301-kami namiesto jednej.
  for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
    if (seen.has(target)) break

    seen.add(target)

    const next = await lookup(target)

    if (!next || seen.has(next)) break

    target = next
  }

  return target === start ? null : target
}

// --- Zápis -----------------------------------------------------------------

type UpsertArgs = {
  from: string
  req: PayloadRequest
  to: string
}

const findRedirectByFrom = async ({ from, req }: { from: string; req: PayloadRequest }) => {
  const result = await req.payload.find({
    collection: 'redirects',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { from: { equals: from } },
  })

  return result.docs[0] as unknown as RedirectDoc | undefined
}

/**
 * Zapíše (alebo prepíše) presmerovanie `from → to` a pri tom upratuje okolie:
 * zruší slučky, skráti reťazce a zahodí záznamy, ktoré by ukazovali samy na
 * seba. Nikdy nevyhodí výnimku — zlyhanie sa zaloguje, ale uloženie dokumentu
 * nezhodí.
 */
export const upsertSlugRedirect = async ({ from, req, to }: UpsertArgs): Promise<void> => {
  const payload = req.payload

  if (!from || !to || from === to) return

  try {
    // 1. Slučka: ak už niečo presmerúva Z novej adresy, nová adresa by nikdy
    //    nebola dostupná. Taký záznam musí zmiznúť.
    const loop = await payload.find({
      collection: 'redirects',
      depth: 0,
      limit: 50,
      overrideAccess: true,
      req,
      where: { from: { equals: to } },
    })

    for (const doc of loop.docs) {
      await payload.delete({ collection: 'redirects', id: doc.id, overrideAccess: true, req })
    }

    // 2. Skrátenie reťazca: čokoľvek, čo mierilo na starú adresu, mieri odteraz
    //    rovno na novú (A→B, B→C ⇒ A→C).
    const chained = await payload.find({
      collection: 'redirects',
      depth: 0,
      limit: 200,
      overrideAccess: true,
      req,
      where: { 'to.url': { equals: from } },
    })

    for (const doc of chained.docs as unknown as RedirectDoc[]) {
      const docFrom = doc.from ? normalizePath(doc.from) : null

      if (docFrom === to) {
        await payload.delete({ collection: 'redirects', id: doc.id, overrideAccess: true, req })
        continue
      }

      await payload.update({
        collection: 'redirects',
        id: doc.id,
        data: { to: { type: 'custom', url: to } },
        overrideAccess: true,
        req,
      })
    }

    // 3. Samotný nový záznam — `from` je unikátne, takže buď update, alebo create.
    const existing = await findRedirectByFrom({ from, req })

    if (existing) {
      await payload.update({
        collection: 'redirects',
        id: existing.id,
        data: { to: { type: 'custom', url: to } },
        overrideAccess: true,
        req,
      })
    } else {
      await payload.create({
        collection: 'redirects',
        data: { from, to: { type: 'custom', url: to } },
        overrideAccess: true,
        req,
      })
    }

    payload.logger.info(`[redirects] 301 ${from} → ${to}`)
  } catch (err) {
    payload.logger.warn({ err }, `[redirects] Nepodarilo sa uložiť presmerovanie ${from} → ${to}`)
  }
}

/**
 * `afterChange` hook pre kolekciu s vlastnou adresou. Porovná starý a nový
 * `slug` a pri zmene založí presmerovanie.
 *
 * Koncepty sa preskakujú: kolekcia bez verzií `_status` nemá (kategórie), tam
 * je každé uloženie „naživo".
 */
export const createSlugRedirectHook =
  (collection: RedirectCollection): CollectionAfterChangeHook =>
  async ({ doc, operation, previousDoc, req }) => {
    if (operation !== 'update') return doc

    const status = (doc as { _status?: string })?._status

    if (status && status !== 'published') return doc

    const previousSlug = (previousDoc as { slug?: string })?.slug
    const nextSlug = (doc as { slug?: string })?.slug

    if (!previousSlug || !nextSlug || previousSlug === nextSlug) return doc

    const from = publicPathFor(collection, previousSlug)
    const to = publicPathFor(collection, nextSlug)

    if (!from || !to) return doc

    await upsertSlugRedirect({ from, req, to })

    return doc
  }

/** Zmena v kolekcii `redirects` musí okamžite vyprázdniť cache mapy. */
const flushRedirectCache = (payload: PayloadRequest['payload']) => {
  try {
    revalidateTag(REDIRECTS_TAG, 'max')
  } catch (err) {
    // Seed, migrácia či CLI bežia mimo požiadavky Next.js — tam `revalidateTag`
    // hádže a hodinový strop cache je jediná (a postačujúca) poistka.
    payload.logger.debug?.({ err }, '[redirects] revalidateTag mimo požiadavky — preskočené')
  }
}

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { context, payload } }) => {
  if (!context.disableRevalidate) flushRedirectCache(payload)

  return doc
}

export const revalidateRedirectsOnDelete: CollectionAfterDeleteHook = ({
  doc,
  req: { context, payload },
}) => {
  if (!context.disableRevalidate) flushRedirectCache(payload)

  return doc
}
