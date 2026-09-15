import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { Post } from '@/payload-types'

import { CONTACT } from '@/lib/contact'
import { FOOTER_DEFAULTS } from '@/lib/footerDefaults'
import { homepageDefaultData } from '@/lib/homeDefaults'
import { SOCIAL_LINKS, TOP_BAR_LINKS } from '@/lib/navigation'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Minimal Lexical document with a single paragraph — enough for seed copy. */
const paragraph = (text: string) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: null,
        textStyle: '',
        textFormat: 0,
        children: [
          {
            mode: 'normal',
            text,
            type: 'text',
            style: '',
            detail: 0,
            format: 0,
            version: 1,
          },
        ],
      },
    ],
  },
})

/** Textový uzol Lexicalu — základný stavebný kameň nasledujúcich pomocníkov. */
const textNode = (text: string) => ({
  mode: 'normal',
  text,
  type: 'text',
  style: '',
  detail: 0,
  format: 0,
  version: 1,
})

const paragraphNode = (text: string) => ({
  type: 'paragraph',
  format: '' as const,
  indent: 0,
  version: 1,
  direction: null,
  textStyle: '',
  textFormat: 0,
  children: [textNode(text)],
})

const headingNode = (text: string, tag: 'h2' | 'h3' = 'h2') => ({
  type: 'heading',
  tag,
  format: '' as const,
  indent: 0,
  version: 1,
  direction: null,
  children: [textNode(text)],
})

/** Viacodsekový dokument pre blog — `paragraph()` vyššie zvládne len jeden. */
const richTextDoc = (children: unknown[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: null,
    children,
  },
})

const seedProducts = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const existing = await payload.find({ collection: 'products', limit: 1 })

  if (existing.totalDocs > 0) {
    console.log('products already seeded:', existing.totalDocs)
    return
  }

  const cat = await payload.create({
    collection: 'categories',
    data: { title: 'Prútené koše', slug: 'prutene-kose-kat' },
  })
  await payload.create({
    collection: 'products',
    data: {
      title: 'Košík prútený ružový veľký',
      slug: 'prutene-kose',
      inventory: 10,
      enableVariants: false,
      priceInEUREnabled: true,
      priceInEUR: 9900,
      categories: [cat.id],
      // X1 — pairs with the "Materiál" demo filter below.
      filterTags: [{ tag: 'prutie' }],
      _status: 'published',
      description: paragraph('Ručne pletený prútený košík.'),
    },
  })
  await payload.create({
    collection: 'products',
    data: {
      title: 'Pletená deka vlnená',
      slug: 'pletena-deka',
      inventory: 0,
      enableVariants: false,
      priceInEUREnabled: true,
      priceInEUR: 14900,
      categories: [cat.id],
      filterTags: [{ tag: 'vlna' }],
      _status: 'published',
      description: paragraph('Hrubá vlnená deka.'),
    },
  })
  console.log('seeded 2 products')
}

/**
 * Produktové fotografie (Y2).
 *
 * The demo products were seeded without a gallery, which made them invisible to
 * anything that needs an image: the product card, the PDP — and the product
 * feeds, where `image_link` is a required attribute, so an image-less product
 * is dropped from the feed entirely.
 *
 * Reuses the two hero photos already committed under `public/assets/images`
 * instead of adding new binaries. Idempotent twice over: a product that already
 * has a gallery is left alone, and the media document is looked up by filename
 * before it is created.
 */
const seedProductImages = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const demoImages = [
    {
      alt: 'Prútený košík ZAPLETANE',
      file: 'hero-kolekcia.webp',
      slug: 'prutene-kose',
    },
    {
      alt: 'Pletená vlnená deka ZAPLETANE',
      file: 'hero-zahrada.webp',
      slug: 'pletena-deka',
    },
  ]

  for (const demo of demoImages) {
    const { docs } = await payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      where: { slug: { equals: demo.slug } },
    })

    const product = docs[0]

    if (!product || product.gallery?.length) continue

    const existingMedia = await payload.find({
      collection: 'media',
      limit: 1,
      where: { filename: { equals: demo.file } },
    })

    const mediaId =
      existingMedia.docs[0]?.id ??
      (
        await payload.create({
          collection: 'media',
          data: { alt: demo.alt },
          filePath: path.resolve(projectRoot, 'public/assets/images/hero', demo.file),
        })
      ).id

    await payload.update({
      collection: 'products',
      id: product.id,
      data: { gallery: [{ image: mediaId }] },
    })

    console.log(`attached gallery image to: ${demo.slug}`)
  }
}

/**
 * Doprava + platby (W1).
 *
 * Idempotent by `title`, and run on every seed — not just on an empty database
 * — so an existing dev database picks the new rows up too. Prices are in
 * eurocents.
 */
const seedCheckoutMethods = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const shippingMethods = [
    {
      title: 'Kuriér',
      description: 'Doručenie na adresu kuriérskou službou.',
      deliveryEstimate: '2–4 dni',
      enabled: true,
      // X1 — doprava zadarmo od 100 €, aplikovaná na serveri vo fees.ts.
      freeAboveSubtotal: 10000,
      price: 490,
      sortOrder: 10,
      type: 'courier' as const,
    },
    {
      title: 'Osobný odber',
      description: 'Vyzdvihnutie po telefonickej dohode.',
      deliveryEstimate: 'Po dohode',
      enabled: true,
      // Už je zadarmo — prah nedáva zmysel.
      freeAboveSubtotal: null,
      price: 0,
      sortOrder: 20,
      type: 'personal' as const,
    },
  ]

  for (const data of shippingMethods) {
    const existing = await payload.find({
      collection: 'shipping-methods',
      limit: 1,
      where: { title: { equals: data.title } },
    })

    const existingDoc = existing.docs[0]

    if (existingDoc) {
      // Back-fill only the free-delivery threshold, and only when the row does
      // not have one yet — a shop that deliberately cleared it keeps its choice.
      if (data.freeAboveSubtotal && existingDoc.freeAboveSubtotal == null) {
        await payload.update({
          collection: 'shipping-methods',
          id: existingDoc.id,
          data: { freeAboveSubtotal: data.freeAboveSubtotal },
        })
        console.log(`set free-shipping threshold on: ${data.title}`)
      }
      continue
    }

    await payload.create({ collection: 'shipping-methods', data })
    console.log(`seeded shipping method: ${data.title}`)
  }

  const paymentMethods = [
    {
      title: 'Dobierka',
      description: 'Zaplatíte kuriérovi pri prevzatí zásielky.',
      enabled: true,
      instructions: paragraph('Sumu uhradíte v hotovosti alebo kartou pri prevzatí zásielky.'),
      sortOrder: 10,
      surcharge: 150,
      type: 'cod' as const,
    },
    {
      title: 'Bankový prevod',
      description: 'Platobné údaje dostanete hneď po odoslaní objednávky.',
      enabled: true,
      instructions: paragraph(
        'Objednávku expedujeme po pripísaní platby na náš účet. Ako variabilný symbol uveďte číslo objednávky.',
      ),
      sortOrder: 20,
      surcharge: 0,
      type: 'bankTransfer' as const,
    },
    {
      title: 'Platba kartou',
      description: 'Online platba cez zabezpečenú platobnú bránu.',
      // Stays OFF until Comgate credentials exist — see src/payments/comgate.
      enabled: false,
      gateway: 'comgate' as const,
      sortOrder: 30,
      surcharge: 0,
      type: 'card' as const,
    },
  ]

  for (const data of paymentMethods) {
    const existing = await payload.find({
      collection: 'payment-methods',
      limit: 1,
      where: { title: { equals: data.title } },
    })

    if (existing.totalDocs > 0) {
      continue
    }

    await payload.create({ collection: 'payment-methods', data })
    console.log(`seeded payment method: ${data.title}`)
  }
}

/**
 * Zľavové kódy a filtre v obchode (X1).
 *
 * Idempotent by the natural key (`code` / `slug`) and run on every seed, like
 * the checkout methods above, so an existing dev database picks the demo rows
 * up without losing anything. `usedCount` is never written here — it belongs to
 * the order-creation path alone.
 */
const seedDiscountsAndFilters = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const discountCodes = [
    {
      code: 'ZAPLETANE10',
      enabled: true,
      note: 'Demo kód pre vývoj a testovanie pokladne.',
      type: 'percent' as const,
      value: 10,
    },
  ]

  for (const data of discountCodes) {
    const existing = await payload.find({
      collection: 'discount-codes',
      limit: 1,
      where: { code: { equals: data.code } },
    })

    if (existing.totalDocs > 0) {
      continue
    }

    await payload.create({ collection: 'discount-codes', data })
    console.log(`seeded discount code: ${data.code}`)
  }

  const filters = [
    {
      slug: 'material',
      enabled: true,
      label: 'Materiál',
      options: [
        { label: 'Vlna', value: 'vlna' },
        { label: 'Prútie', value: 'prutie' },
      ],
      sortOrder: 10,
      type: 'tags' as const,
    },
  ]

  for (const data of filters) {
    const existing = await payload.find({
      collection: 'product-filters',
      limit: 1,
      where: { slug: { equals: data.slug } },
    })

    if (existing.totalDocs > 0) {
      continue
    }

    await payload.create({ collection: 'product-filters', data })
    console.log(`seeded product filter: ${data.label}`)
  }
}

/**
 * Vlastnosti produktov, rozmery a odporúčania (Y1).
 *
 * Idempotent by the natural key (`slug`) and run on every seed, so an existing
 * dev database picks the demo data up too. Deliberately non-destructive: a
 * product that already has properties / dimensions / cross-sell or upsell links
 * keeps them — the seed only fills what is still empty.
 *
 * The property *definitions* are shop-wide ("Materiál", "Farba"); the value is
 * per product. `predefinedValues` are suggestions only, which is why the basket
 * may say "prútie" (a listed suggestion) and "ružová" (not listed anywhere).
 */
const seedProductPropertiesAndRelations = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
) => {
  const propertyDefs = [
    {
      name: 'Materiál',
      slug: 'material',
      predefinedValues: [{ value: 'vlna' }, { value: 'bavlna' }, { value: 'prútie' }],
      sortOrder: 10,
    },
    {
      name: 'Farba',
      slug: 'farba',
      sortOrder: 20,
    },
  ]

  /** property slug -> id, so the product wiring below can reference them. */
  const propertyIds = new Map<string, number | string>()

  for (const data of propertyDefs) {
    const existing = await payload.find({
      collection: 'product-properties',
      limit: 1,
      where: { slug: { equals: data.slug } },
    })

    const existingDoc = existing.docs[0]

    if (existingDoc) {
      propertyIds.set(data.slug, existingDoc.id)
      continue
    }

    const created = await payload.create({ collection: 'product-properties', data })
    propertyIds.set(data.slug, created.id)
    console.log(`seeded product property: ${data.name}`)
  }

  const demoProducts = [
    {
      slug: 'prutene-kose',
      properties: [
        { property: 'material', value: 'prútie' },
        { property: 'farba', value: 'ružová' },
      ],
      dimensions: { width: 40, height: 25, depth: 30, weight: 900 },
      // Do košíka k deke sa hodí aj kôš — a naopak: kôš je drahšia/lepšia
      // alternatíva, ktorú ukazujeme na stránke deky.
      crossSell: ['pletena-deka'],
      upsell: [] as string[],
    },
    {
      slug: 'pletena-deka',
      properties: [
        { property: 'material', value: 'vlna' },
        { property: 'farba', value: 'béžová' },
      ],
      dimensions: { width: 130, height: 170, depth: 3, weight: 1800 },
      crossSell: [] as string[],
      upsell: ['prutene-kose'],
    },
  ]

  const productIdBySlug = new Map<string, number | string>()

  for (const demo of demoProducts) {
    const found = await payload.find({
      collection: 'products',
      limit: 1,
      where: { slug: { equals: demo.slug } },
    })

    if (found.docs[0]) {
      productIdBySlug.set(demo.slug, found.docs[0].id)
    }
  }

  for (const demo of demoProducts) {
    const productId = productIdBySlug.get(demo.slug)

    if (!productId) {
      continue
    }

    const current = await payload.findByID({ collection: 'products', id: productId, depth: 0 })

    const data: Record<string, unknown> = {}

    if (!current.properties?.length) {
      const properties = demo.properties
        .map((entry) => ({ property: propertyIds.get(entry.property), value: entry.value }))
        .filter((entry): entry is { property: number | string; value: string } =>
          Boolean(entry.property),
        )

      if (properties.length) {
        data.properties = properties
      }
    }

    const dimensions = current.dimensions

    if (
      dimensions?.width == null &&
      dimensions?.height == null &&
      dimensions?.depth == null &&
      dimensions?.weight == null
    ) {
      data.dimensions = demo.dimensions
    }

    const crossSell = demo.crossSell
      .map((slug) => productIdBySlug.get(slug))
      .filter((id): id is number | string => Boolean(id))

    if (crossSell.length && !current.crossSell?.length) {
      data.crossSell = crossSell
    }

    const upsell = demo.upsell
      .map((slug) => productIdBySlug.get(slug))
      .filter((id): id is number | string => Boolean(id))

    if (upsell.length && !current.upsell?.length) {
      data.upsell = upsell
    }

    if (Object.keys(data).length === 0) {
      continue
    }

    await payload.update({ collection: 'products', id: productId, data })
    console.log(`filled product data (${Object.keys(data).join(', ')}) on: ${demo.slug}`)
  }
}

/**
 * Editable content (W2).
 *
 * Writes the *current hard-coded* values into the globals so an editor opens a
 * populated admin form instead of empty fields. Deliberately additive and
 * non-destructive:
 *
 *   - `homepage` is written only when the global has never been saved, so a
 *     local edit is never stomped on by a re-seed.
 *   - `footer` / `header` / `site-settings` already exist in some databases, so
 *     only the fields that are still empty get filled in.
 *
 * Nothing here changes what the storefront renders — every value is the one the
 * component fell back to anyway. Navigation items (`header.navItems`,
 * `footer.navItems`) are NOT seeded: they were never hard-coded, so inventing
 * them would be a visible change.
 */
const seedContentGlobals = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const homepage = await payload.findGlobal({ slug: 'homepage', depth: 0 })

  if (!homepage?.updatedAt) {
    await payload.updateGlobal({ slug: 'homepage', data: homepageDefaultData() })
    console.log('seeded homepage global (hero, slogan, features, tabs, categories, gift CTA)')
  }

  // NB: `findGlobal` on a never-saved global returns the field defaults, so the
  // checks below test `updatedAt` (has this global a row at all?) as well as
  // the individual fields (does an existing row still miss them?).
  const footer = await payload.findGlobal({ slug: 'footer', depth: 0 })

  if (!footer?.updatedAt || !footer?.description || !footer?.socialLinks?.length) {
    await payload.updateGlobal({
      slug: 'footer',
      data: {
        description: footer?.description || FOOTER_DEFAULTS.description,
        navTitle: footer?.navTitle || FOOTER_DEFAULTS.navTitle,
        socialLinks: footer?.socialLinks?.length
          ? footer.socialLinks
          : SOCIAL_LINKS.map((social) => ({ platform: social.platform, url: social.url })),
        contact: { ...FOOTER_DEFAULTS.contact, ...(footer?.contact || {}) },
        support: { ...FOOTER_DEFAULTS.support, ...(footer?.support || {}) },
        bottomBar: { ...FOOTER_DEFAULTS.bottomBar, ...(footer?.bottomBar || {}) },
      },
    })
    console.log('seeded footer global (description, socials, column copy, bottom bar)')
  }

  const header = await payload.findGlobal({ slug: 'header', depth: 0 })

  if (!header?.updatedAt || !header?.topBar?.links?.length) {
    await payload.updateGlobal({
      slug: 'header',
      data: {
        topBar: {
          links: TOP_BAR_LINKS.map((item) => ({
            href: item.href,
            highlight: item.highlight,
            icon: item.icon,
            label: item.label,
          })),
        },
      },
    })
    console.log('seeded header global (top bar links)')
  }

  const siteSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })

  const needsContact =
    !siteSettings?.updatedAt || !siteSettings?.contact?.phone || !siteSettings?.contact?.email
  // X1 — the search multi-select lives in its own table and so starts empty on a
  // row saved before the field existed; the scalars carry SQL defaults.
  const needsSearchFields = !siteSettings?.search?.searchFields?.length
  // Z1 — the mobile search overlay's empty state ("Odporúčané kategórie" /
  // "Odporúčané produkty"). Only filled in when the editor has chosen nothing
  // yet, so a local pick is never overwritten by a re-seed; an empty shop
  // simply leaves both lists empty and the overlay shows its hint text.
  const needsRecommended =
    !siteSettings?.search?.recommendedProducts?.length &&
    !siteSettings?.search?.recommendedCategories?.length

  const recommended = needsRecommended
    ? await demoSearchRecommendations(payload)
    : { categories: [], products: [] }
  const hasRecommended = recommended.products.length > 0 || recommended.categories.length > 0

  if (needsContact || needsSearchFields || hasRecommended) {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        contact: {
          ...(siteSettings?.contact || {}),
          companyName: siteSettings?.contact?.companyName || CONTACT.brandName,
          email: siteSettings?.contact?.email || CONTACT.email.info,
          phone: siteSettings?.contact?.phone || CONTACT.phone.display,
        },
        search: {
          ...(siteSettings?.search || {}),
          minChars: siteSettings?.search?.minChars ?? 2,
          placeholder: siteSettings?.search?.placeholder || 'Hľadať produkty…',
          resultsPerPage: siteSettings?.search?.resultsPerPage ?? 12,
          searchFields: siteSettings?.search?.searchFields?.length
            ? siteSettings.search.searchFields
            : ['title', 'description'],
          ...(hasRecommended
            ? {
                recommendedCategories: recommended.categories,
                recommendedProducts: recommended.products,
              }
            : {}),
        },
      },
    })
    console.log(
      hasRecommended
        ? 'seeded site settings (contact details + search defaults + search recommendations)'
        : 'seeded site settings (contact details + search defaults)',
    )
  }
}

/**
 * Picks what the search overlay recommends locally: the first few published
 * products and the shop's categories. Reads whatever the database happens to
 * hold (demo or real), so it works on a freshly seeded DB and on one someone
 * has already played with.
 */
const demoSearchRecommendations = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const [products, categories] = await Promise.all([
    payload.find({
      collection: 'products',
      depth: 0,
      limit: 3,
      pagination: false,
      sort: 'title',
      where: { _status: { equals: 'published' } },
    }),
    payload.find({ collection: 'categories', depth: 0, limit: 4, pagination: false }),
  ])

  return {
    categories: categories.docs.map((doc) => doc.id),
    products: products.docs.map((doc) => doc.id),
  }
}

/**
 * Demo customer for the account section (Z2).
 *
 * Gives /account, /account/addresses and /orders something real to render in
 * local development: one customer, both address slots filled, two orders in
 * different states. Fully idempotent — the user is looked up by e-mail, each
 * address slot by `kind`, and the orders are only ever created when the demo
 * customer has none, so a re-seed never duplicates or overwrites anything.
 *
 * Dev fixture only: the credentials are deliberately trivial and the e-mail
 * uses the non-routable `.test` TLD.
 */
const DEMO_CUSTOMER = {
  email: 'demo@zapletane.test',
  name: 'Demo Zákazníčka',
  password: 'demo1234',
}

const seedDemoCustomer = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const existingUsers = await payload.find({
    collection: 'users',
    limit: 1,
    where: { email: { equals: DEMO_CUSTOMER.email } },
  })

  const customer =
    existingUsers.docs[0] ??
    (await payload.create({
      collection: 'users',
      data: {
        email: DEMO_CUSTOMER.email,
        name: DEMO_CUSTOMER.name,
        password: DEMO_CUSTOMER.password,
      },
    }))

  if (!existingUsers.docs[0]) {
    console.log(`seeded demo customer: ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`)
  }

  const addresses = [
    {
      city: 'Bratislava',
      company: 'Zapletané s.r.o.',
      country: 'SK' as const,
      firstName: 'Demo',
      kind: 'billing' as const,
      lastName: 'Zákazníčka',
      addressLine1: 'Hlavná 12',
      phone: '+421 915 675 870',
      postalCode: '83101',
      title: 'Pani',
    },
    {
      city: 'Žilina',
      country: 'SK' as const,
      firstName: 'Demo',
      kind: 'shipping' as const,
      lastName: 'Zákazníčka',
      addressLine1: 'Kvetná 4',
      addressLine2: '2. poschodie',
      phone: '+421 915 675 870',
      postalCode: '01001',
      title: 'Pani',
    },
  ]

  for (const address of addresses) {
    const existing = await payload.find({
      collection: 'addresses',
      limit: 1,
      where: {
        and: [{ customer: { equals: customer.id } }, { kind: { equals: address.kind } }],
      },
    })

    if (existing.totalDocs > 0) continue

    await payload.create({
      collection: 'addresses',
      data: { ...address, customer: customer.id },
    })
    console.log(`seeded demo ${address.kind} address`)
  }

  const existingOrders = await payload.find({
    collection: 'orders',
    limit: 1,
    where: { customer: { equals: customer.id } },
  })

  if (existingOrders.totalDocs > 0) return

  const products = await payload.find({ collection: 'products', depth: 0, limit: 2 })
  const [firstProduct, secondProduct] = products.docs

  if (!firstProduct) {
    console.log('no products yet — skipping demo orders')
    return
  }

  const shippingAddress = {
    city: 'Žilina',
    country: 'SK' as const,
    firstName: 'Demo',
    lastName: 'Zákazníčka',
    addressLine1: 'Kvetná 4',
    phone: '+421 915 675 870',
    postalCode: '01001',
  }

  // Amounts are in eurocents, exactly like the checkout writes them: the item
  // subtotal plus the fees, minus the discount — so the order detail's
  // breakdown adds up to the total it prints.
  const priceOf = (product: (typeof products.docs)[number]) => product?.priceInEUR ?? 0
  const firstPrice = priceOf(firstProduct)
  const secondPrice = secondProduct ? priceOf(secondProduct) : 0

  const demoOrders = [
    {
      amount: firstPrice + 450 + 150,
      codFee: 150,
      currency: 'EUR' as const,
      customer: customer.id,
      customerEmail: DEMO_CUSTOMER.email,
      items: [{ product: firstProduct.id, quantity: 1 }],
      paymentType: 'cod' as const,
      shippingAddress,
      shippingFee: 450,
      status: 'processing' as const,
    },
    {
      amount: firstPrice * 2 + secondPrice - 500,
      codFee: 0,
      currency: 'EUR' as const,
      customer: customer.id,
      customerEmail: DEMO_CUSTOMER.email,
      discountAmount: 500,
      discountCode: 'VITAJTE10',
      items: [
        { product: firstProduct.id, quantity: 2 },
        ...(secondProduct ? [{ product: secondProduct.id, quantity: 1 }] : []),
      ],
      paymentType: 'bankTransfer' as const,
      shippingAddress,
      shippingFee: 0,
      status: 'completed' as const,
    },
  ]

  for (const data of demoOrders) {
    await payload.create({ collection: 'orders', data })
  }

  console.log(`seeded ${demoOrders.length} demo orders for ${DEMO_CUSTOMER.email}`)
}

/**
 * Dva ukážkové články (Z7), aby `/blog` nebolo prázdne a dalo sa na ňom hneď
 * vidieť, ako karta aj detail vyzerajú s reálnym textom.
 *
 * Idempotentné: ak už nejaký článok existuje, nerobí nič — opakované spustenie
 * seedu teda nevytvorí štvoricu duplikátov s príponami `-2`.
 *
 * Adresy (`slug`) sa zámerne nevypĺňajú: majú vzniknúť tým istým hookom, ktorý
 * ich vyrába v admine, takže seed je zároveň najlacnejšia kontrola, že prevod
 * názvu na adresu (vrátane diakritiky) funguje.
 */
const seedBlogPosts = async (payload: Awaited<ReturnType<typeof getPayload>>) => {
  const existing = await payload.find({ collection: 'posts', limit: 1 })

  if (existing.totalDocs > 0) {
    console.log('blog posts already seeded:', existing.totalDocs)
    return
  }

  // Ak už máme nahraný nejaký obrázok, prvý poslúži ako úvodný — karta blogu
  // tak nie je len sivý obdĺžnik.
  const media = await payload.find({ collection: 'media', depth: 0, limit: 1 })
  const heroImage = media.docs[0]?.id

  const posts = [
    {
      title: 'Ako vzniká ručne pletená deka',
      excerpt:
        'Od klbka po hotový kus: koľko priadze deka spotrebuje, prečo pleteniu trvá týždne a čo sa stane, keď sa pomýlime v jednom oku.',
      content: richTextDoc([
        paragraphNode(
          'Každá deka sa začína výberom priadze. Pracujeme s vlnou, ktorá je dosť hrubá na to, aby držala tvar, a zároveň dosť mäkká na to, aby sa pod ňou dalo zaspať.',
        ),
        headingNode('Prvé oká'),
        paragraphNode(
          'Nahodenie okien je najpomalšia časť celej práce. Ich počet určuje šírku deky a už sa nedá zmeniť — preto sa ráta dvakrát a pletie až potom.',
        ),
        headingNode('Týždne, nie hodiny'),
        paragraphNode(
          'Na jednu veľkú deku padne aj tridsať hodín práce rozložených do niekoľkých týždňov. Nie preto, že by to inak nešlo, ale preto, že pletenie v zhone je na výsledku vidieť.',
        ),
      ]),
      publishedAt: new Date('2026-08-18T09:00:00.000Z').toISOString(),
    },
    {
      title: 'Starostlivosť o vlnené kúsky',
      excerpt:
        'Vlna nepotrebuje časté pranie — potrebuje vzduch, chlad a trochu trpezlivosti. Zhrnuli sme, čo jej prospieva a čo ju zničí.',
      content: richTextDoc([
        paragraphNode(
          'Vlnená deka vydrží roky, ak s ňou zaobchádzate ako s vlnou, nie ako s bavlnou. Najdôležitejšie pravidlo znie: menej prania, viac vetrania.',
        ),
        headingNode('Pranie'),
        paragraphNode(
          'Ručne, vo vlažnej vode do tridsiatich stupňov, s prípravkom na vlnu. Nikdy nedrhnúť a nežmýkať — vlna sa tým plstnatí a späť sa už nedostane.',
        ),
        headingNode('Sušenie'),
        paragraphNode(
          'Vodu jemne vytlačte v uteráku a deku sušte rozloženú naplocho, mimo priameho slnka a radiátora. Zavesená deka sa vytiahne vlastnou váhou.',
        ),
      ]),
      publishedAt: new Date('2026-09-02T09:00:00.000Z').toISOString(),
    },
  ]

  for (const post of posts) {
    const created = await payload.create({
      collection: 'posts',
      data: {
        ...post,
        content: post.content as Post['content'],
        ...(heroImage ? { heroImage } : {}),
        // Prázdne = hook `slugField` doplní adresu z názvu. Typ ho vyžaduje
        // (pole je `required`), hodnota sa ale vždy prepíše.
        slug: '',
        _status: 'published',
      },
    })

    console.log(`seeded blog post "${post.title}" -> /blog/${created.slug}`)
  }
}

const run = async () => {
  const payload = await getPayload({ config })

  await seedProducts(payload)
  await seedProductImages(payload)
  await seedCheckoutMethods(payload)
  await seedDiscountsAndFilters(payload)
  await seedProductPropertiesAndRelations(payload)
  await seedContentGlobals(payload)
  await seedBlogPosts(payload)
  await seedDemoCustomer(payload)

  await payload.destroy()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
