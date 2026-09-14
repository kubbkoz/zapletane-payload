import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

const run = async () => {
  const payload = await getPayload({ config })
  const existing = await payload.find({ collection: 'products', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('products already seeded:', existing.totalDocs)
    await payload.destroy()
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
      description: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textStyle: '', textFormat: 0, children: [{ mode: 'normal', text: 'Ručne pletený prútený košík.', type: 'text', style: '', detail: 0, format: 0, version: 1 }] }] } },
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
      description: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textStyle: '', textFormat: 0, children: [{ mode: 'normal', text: 'Hrubá vlnená deka.', type: 'text', style: '', detail: 0, format: 0, version: 1 }] }] } },
    },
  })
  console.log('seeded 2 products')
  await payload.destroy()
}
run().catch((e) => { console.error(e); process.exit(1) })
