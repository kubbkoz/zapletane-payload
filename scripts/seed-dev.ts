import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { CONTACT } from '@/lib/contact'
import { FOOTER_DEFAULTS } from '@/lib/footerDefaults'
import { homepageDefaultData } from '@/lib/homeDefaults'
import { SOCIAL_LINKS, TOP_BAR_LINKS } from '@/lib/navigation'

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
      _status: 'published',
      description: paragraph('Hrubá vlnená deka.'),
    },
  })
  console.log('seeded 2 products')
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
      price: 490,
      sortOrder: 10,
      type: 'courier' as const,
    },
    {
      title: 'Osobný odber',
      description: 'Vyzdvihnutie po telefonickej dohode.',
      deliveryEstimate: 'Po dohode',
      enabled: true,
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

    if (existing.totalDocs > 0) {
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

  if (!siteSettings?.updatedAt || !siteSettings?.contact?.phone || !siteSettings?.contact?.email) {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        contact: {
          ...(siteSettings?.contact || {}),
          companyName: siteSettings?.contact?.companyName || CONTACT.brandName,
          email: siteSettings?.contact?.email || CONTACT.email.info,
          phone: siteSettings?.contact?.phone || CONTACT.phone.display,
        },
      },
    })
    console.log('seeded site settings contact details (phone, e-mail, company name)')
  }
}

const run = async () => {
  const payload = await getPayload({ config })

  await seedProducts(payload)
  await seedCheckoutMethods(payload)
  await seedContentGlobals(payload)

  await payload.destroy()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
