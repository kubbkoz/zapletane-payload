import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

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

const run = async () => {
  const payload = await getPayload({ config })

  await seedProducts(payload)
  await seedCheckoutMethods(payload)

  await payload.destroy()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
