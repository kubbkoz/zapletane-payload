import type { FieldHook, PayloadRequest, RowField } from 'payload'

import { formatSlug } from '@/utilities/formatSlug'

/**
 * Jednotná „URL adresa" pre každú kolekciu, ktorá má vlastnú stránku
 * (produkty, kategórie, stránky, blog) — Z7.
 *
 * Prečo vlastná továreň a nie `slugField()` z Payloadu: ten experimentálny
 * field slug po prvom publikovaní zámerne *zamrzne* („the slug should
 * stabilize … to protect modifying potentially live URLs"). Majiteľka ale
 * chce presný opak: keď premenuje článok, adresa sa má prepísať a stará sa má
 * automaticky presmerovať (o to sa stará `src/lib/redirects.ts`). Rozhodnutie
 * „prepísať / neprepísať" tu preto neriadi počet verzií, ale jedno viditeľné
 * zaškrtávacie políčko `slugLock` — „URL upravujem ručne".
 *
 * Správanie (`useAsSlug` je predvolene `title`):
 *
 * | stav                                   | výsledok                          |
 * |----------------------------------------|-----------------------------------|
 * | vytvorenie, slug prázdny                | vygeneruje sa z názvu             |
 * | vytvorenie, slug vyplnený               | ponechá sa (len sa očistí)        |
 * | úprava, slug prázdny                    | vygeneruje sa z názvu             |
 * | úprava, zmenený názov, zámok vypnutý    | **prepíše sa** z nového názvu     |
 * | úprava, zmenený názov, zámok zapnutý    | ponechá sa                        |
 * | úprava, názov nezmenený                 | ponechá sa (ručná zmena prejde)   |
 * | kolízia s iným dokumentom               | pripojí sa `-2`, `-3`, …          |
 *
 * Autosave (produkty a stránky ho majú zapnutý) je zámerne vynechaný: inak by
 * sa adresa prepisovala po každom stlačení klávesy počas písania názvu a pri
 * každom takom kroku by vznikalo nové presmerovanie. Skutočné uloženie
 * (publikovanie aj ručné „Uložiť koncept") autosave príznak nenesie, takže sa
 * slug prepočíta s finálnym názvom.
 */

export type SlugFieldArgs = {
  /** Popis pod poľom v admine. */
  description?: string
  /** Meno zámku. Mení schému — nemeň bez migrácie. */
  lockName?: string
  /** Kde sa dvojica zobrazí v admine. `undefined` = v hlavnom stĺpci. */
  position?: 'sidebar' | undefined
  /**
   * Ponechá skrytý stĺpec `generateSlug` po pôvodnom `slugField()` z Payloadu.
   * Zapnuté pri kolekciách, ktoré ten stĺpec v databáze už majú
   * (`pages`, `products`, `categories`) — vďaka tomu je prechod na túto
   * továreň čisto prírastková zmena schémy: nič sa nezahadzuje, len pribudne
   * `slug_lock`. Nové kolekcie ho nepotrebujú.
   */
  retainLegacyCheckbox?: boolean
  /** Meno samotného poľa. Mení schému — nemeň bez migrácie. */
  slugName?: string
  /** Pole, z ktorého sa adresa generuje. */
  useAsSlug?: string
}

/** Poistka proti nekonečnému cyklu pri hľadaní voľnej adresy. */
const MAX_COLLISION_ATTEMPTS = 100

const readKey = (source: unknown, key: string): unknown =>
  source && typeof source === 'object' ? (source as Record<string, unknown>)[key] : undefined

/** Payload posiela `?autosave=true` len pri automatickom ukladaní konceptu. */
const isAutosave = (req?: PayloadRequest): boolean => {
  const value = readKey(req?.query, 'autosave')

  return value === true || value === 'true'
}

/**
 * Prvá voľná adresa v rade `base`, `base-2`, `base-3`, …
 *
 * Vlastný dokument sa z kontroly vynecháva (inak by si každé uloženie
 * pripísalo ďalšiu príponu). `overrideAccess` je zapnuté zámerne: kolízia
 * musí vyjsť najavo aj vtedy, keď je kolidujúci dokument pre práve
 * prihláseného používateľa neviditeľný — inak by uloženie padlo až na unikátny
 * index v databáze, s nezrozumiteľnou hláškou.
 */
const findFreeSlug = async ({
  base,
  collectionSlug,
  id,
  req,
  slugName,
}: {
  base: string
  collectionSlug?: string
  id?: number | string
  req: PayloadRequest
  slugName: string
}): Promise<string> => {
  if (!collectionSlug || !req?.payload) return base

  let candidate = base

  for (let suffix = 2; suffix <= MAX_COLLISION_ATTEMPTS; suffix++) {
    try {
      const existing = await req.payload.find({
        collection: collectionSlug as Parameters<typeof req.payload.find>[0]['collection'],
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
        where:
          id === undefined || id === null
            ? { [slugName]: { equals: candidate } }
            : {
                and: [{ [slugName]: { equals: candidate } }, { id: { not_equals: id } }],
              },
      })

      if (existing.docs.length === 0) return candidate
    } catch {
      // Nedostupná databáza alebo kolekcia bez tohto poľa — radšej pôvodná
      // hodnota než zhodené uloženie.
      return candidate
    }

    candidate = `${base}-${suffix}`
  }

  return candidate
}

const buildSlugHook =
  ({
    lockName,
    slugName,
    useAsSlug,
  }: {
    lockName: string
    slugName: string
    useAsSlug: string
  }): FieldHook =>
  async ({ collection, data, operation, originalDoc, req, siblingData, value }) => {
    // Pri riadku (`type: 'row'`) je `siblingData` celý dokument, takže obe
    // cesty vedú k rovnakým hodnotám — `data` má prednosť, lebo pri úprave
    // obsahuje len to, čo sa naozaj mení.
    const pick = (key: string): unknown => {
      const fromData = readKey(data, key)

      if (fromData !== undefined) return fromData

      const fromSibling = readKey(siblingData, key)

      if (fromSibling !== undefined) return fromSibling

      return readKey(originalDoc, key)
    }

    const titleValue = pick(useAsSlug)
    const title = typeof titleValue === 'string' ? titleValue : ''
    const locked = pick(lockName) === true
    const current = typeof value === 'string' ? value.trim() : ''

    const storedSlugValue = readKey(originalDoc, slugName)
    const storedSlug = typeof storedSlugValue === 'string' ? storedSlugValue : ''

    let base: string

    if (operation === 'create') {
      base = formatSlug(current) || formatSlug(title)
    } else {
      const incomingTitle = readKey(data, useAsSlug)
      const storedTitle = readKey(originalDoc, useAsSlug)
      const titleChanged =
        typeof incomingTitle === 'string' && incomingTitle !== storedTitle && Boolean(incomingTitle)

      if (!current) {
        base = formatSlug(title)
      } else if (locked) {
        base = formatSlug(current)
      } else if (titleChanged && !isAutosave(req)) {
        base = formatSlug(title)
      } else {
        base = formatSlug(current)
      }
    }

    // Niet z čoho generovať — nech sa ozve `required`, nie tichý prázdny slug.
    if (!base) return value ?? undefined

    // Nič sa nemení: ušetríme dopyt do databázy pri každom uložení.
    if (base === storedSlug) return base

    return findFreeSlug({
      base,
      collectionSlug: collection?.slug,
      id: (readKey(originalDoc, 'id') as number | string | undefined) ?? undefined,
      req,
      slugName,
    })
  }

/**
 * Dvojica polí „URL adresa" + „URL upravujem ručne" v jednom riadku.
 * Vracia jedno `row` pole, takže v databáze vzniknú dva ploché stĺpce
 * (`slug`, `slug_lock`) — rovnako ako pri pôvodnom `slugField()`.
 */
export const slugField = ({
  description,
  lockName = 'slugLock',
  position = 'sidebar',
  retainLegacyCheckbox = false,
  slugName = 'slug',
  useAsSlug = 'title',
}: SlugFieldArgs = {}): RowField => ({
  type: 'row',
  admin: { position },
  fields: [
    {
      name: slugName,
      type: 'text',
      label: 'URL adresa (slug)',
      admin: {
        description:
          description ??
          'Časť adresy za lomkou. Prázdne = doplní sa z názvu (bez diakritiky). Pri zmene názvu sa prepíše automaticky a na starú adresu vznikne presmerovanie.',
        width: '100%',
      },
      hooks: {
        beforeValidate: [buildSlugHook({ lockName, slugName, useAsSlug })],
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: lockName,
      type: 'checkbox',
      label: 'URL upravujem ručne',
      admin: {
        description:
          'Zapni, ak si adresu chceš napísať sama — potom ju premenovanie názvu už nikdy neprepíše.',
        width: '100%',
      },
      defaultValue: false,
    },
    // --- Pozostatok po `slugField()` z Payloadu ---------------------------
    // `pages`, `products` a `categories` majú stĺpec `generate_slug` od prvej
    // migrácie. Bez hookov už nič neriadi — riadenie prevzal `slugLock`
    // vyššie — ale ponecháva sa zámerne: keby pole zmizlo, prechod na túto
    // továreň by prestal byť čisto prírastkovou zmenou schémy a migrácia by
    // na ostrej databáze musela stĺpec zahodiť. Za jeden nevyužitý boolean to
    // nestojí; odstrániť sa dá kedykoľvek neskôr, samostatnou migráciou.
    ...(retainLegacyCheckbox
      ? ([
          {
            name: 'generateSlug',
            type: 'checkbox',
            admin: {
              disableBulkEdit: true,
              disableGroupBy: true,
              disableListColumn: true,
              disableListFilter: true,
              hidden: true,
            },
            defaultValue: true,
          },
        ] as RowField['fields'])
      : []),
  ],
})

export default slugField
