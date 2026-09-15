import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildMetaTitle,
  buildTemplateMeta,
  generateProductMeta,
  MAX_DESCRIPTION,
  MAX_TITLE,
  MIN_DESCRIPTION,
  type SeoProductInput,
} from '@/seo/generate'
import { buildProductJsonLd, serializeJsonLd } from '@/seo/jsonLd'

/**
 * Automatické SEO meta (Z4).
 *
 * AI vetva sa testuje s podvrhnutým `fetch` — test nesmie volať Claude API
 * (peniaze, sieť, nedeterminizmus). Testuje sa aj to, čo sa stane, keď model
 * vráti nezmysel: musí nastúpiť šablóna.
 */

const lexical = (text: string) =>
  ({
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }) as unknown

const product: SeoProductInput = {
  categories: ['Deky'],
  description: lexical(
    'Ručne pletená deka z jemnej merino vlny, ktorá zahreje počas dlhých zimných večerov. Pletená na objednávku v malej dielni na Orave.',
  ),
  dimensions: { depth: null, height: 200, weight: 1400, width: 130 },
  price: 8900,
  properties: [{ name: 'Materiál', unit: null, value: '100 % merino vlna' }],
  title: 'Pletená deka Orava',
}

const claudeResponse = (text: string) => ({
  json: async () => ({ content: [{ text, type: 'text' }] }),
  ok: true,
  status: 200,
})

const withKey = (value: string) => {
  const previous = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = value
  return () => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = previous
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SEO — šablónový motor', () => {
  it('poskladá titulok so značkou a popis v povolenom rozsahu', () => {
    const meta = buildTemplateMeta(product)

    expect(meta.engine).toBe('template')
    expect(meta.metaTitle).toBe('Pletená deka Orava | ZAPLETANE')
    expect(meta.metaTitle.length).toBeLessThanOrEqual(MAX_TITLE)

    expect(meta.metaDescription.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION)
    expect(meta.metaDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    // Fakty, ktoré robia popis užitočným pre vyhľadávače aj pre LLM.
    expect(meta.metaDescription).toContain('merino vlna')
    expect(meta.metaDescription).toContain('89,00 €')
  })

  it('dlhý názov skracuje na hranici slova a značku ponechá', () => {
    const title = buildMetaTitle(
      'Ručne pletená deka z merino vlny pre detskú izbu v prírodnej farbe',
    )

    expect(title.length).toBeLessThanOrEqual(MAX_TITLE)
    expect(title.endsWith(' | ZAPLETANE')).toBe(true)
    expect(title).not.toMatch(/\s\|/u.source + '$')
    // Nikdy neskončí uprostred slova.
    expect(title.replace(' | ZAPLETANE', '')).toMatch(/[\p{L}\p{N}]$/u)
  })

  it('zvládne produkt bez popisu aj bez ceny', () => {
    const meta = buildTemplateMeta({ title: 'Prútený kôš' })

    expect(meta.metaTitle).toBe('Prútený kôš | ZAPLETANE')
    expect(meta.metaDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    expect(meta.metaDescription).toContain('Prútený kôš')
  })
})

describe('SEO — AI motor (Claude)', () => {
  it('bez kľúča nevolá API a vráti šablónu', async () => {
    const restore = withKey('')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const meta = await generateProductMeta(product)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(meta.engine).toBe('template')

    restore()
  })

  it('použije text z modelu a dorovná limity', async () => {
    const restore = withKey('test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      claudeResponse(
        JSON.stringify({
          metaDescription:
            'Ručne pletená deka zo 100 % merino vlny s rozmermi 130 × 200 cm. Zahreje pri čítaní aj počas chladných večerov a pletie sa na objednávku.',
          metaTitle: 'Pletená deka Orava | ZAPLETANE',
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const meta = await generateProductMeta(product)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as { headers: Record<string, string> }).headers['anthropic-version']).toBe(
      '2023-06-01',
    )

    expect(meta.engine).toBe('ai')
    expect(meta.metaTitle.endsWith(' | ZAPLETANE')).toBe(true)
    expect(meta.metaTitle.length).toBeLessThanOrEqual(MAX_TITLE)
    expect(meta.metaDescription.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION)
    expect(meta.metaDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION)

    restore()
  })

  it('doplní chýbajúcu značku a oreže pridlhý popis z modelu', async () => {
    const restore = withKey('test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        claudeResponse(
          '```json\n' +
            JSON.stringify({
              metaDescription: `Ručne pletená deka z merino vlny. ${'Veľmi dlhý popis, ktorý model vrátil bez ohľadu na limit. '.repeat(5)}`,
              metaTitle: 'Pletená deka Orava',
            }) +
            '\n```',
        ),
      ),
    )

    const meta = await generateProductMeta(product)

    expect(meta.engine).toBe('ai')
    expect(meta.metaTitle).toBe('Pletená deka Orava | ZAPLETANE')
    expect(meta.metaDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION)

    restore()
  })

  it('pri nečitateľnej odpovedi padá na šablónu', async () => {
    const restore = withKey('test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeResponse('Prepáčte, nerozumiem.')))

    const meta = await generateProductMeta(product)

    expect(meta).toEqual(buildTemplateMeta(product))

    restore()
  })

  it('pri chybe siete alebo HTTP chybe padá na šablónu', async () => {
    const restore = withKey('test-key')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect((await generateProductMeta(product)).engine).toBe('template')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}), ok: false, status: 529 }))
    expect((await generateProductMeta(product)).engine).toBe('template')

    restore()
  })
})

describe('SEO — štruktúrované dáta', () => {
  const doc = {
    id: 7,
    categories: [{ id: 1, title: 'Deky' }],
    description: lexical('Ručne pletená deka z merino vlny.'),
    dimensions: { height: 200, weight: 1400, width: 130 },
    gallery: [{ image: { id: 3, url: '/api/media/file/deka.webp' } }],
    inventory: 4,
    priceInEUR: 8900,
    properties: [{ property: { id: 2, name: 'Materiál' }, value: '100 % merino vlna' }],
    slug: 'pletena-deka-orava',
    title: 'Pletená deka Orava',
  }

  it('vyskladá Product s ponukou, dostupnosťou a vlastnosťami', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonLd = buildProductJsonLd(doc as any, 'https://zapletane.sk')

    expect(jsonLd['@type']).toBe('Product')
    expect(jsonLd.name).toBe('Pletená deka Orava')
    expect(jsonLd.image).toEqual(['https://zapletane.sk/api/media/file/deka.webp'])
    expect(jsonLd.brand).toEqual({ '@type': 'Brand', name: 'ZAPLETANE' })

    const offers = jsonLd.offers as Record<string, unknown>
    expect(offers.price).toBe('89.00')
    expect(offers.priceCurrency).toBe('EUR')
    expect(offers.availability).toBe('https://schema.org/InStock')
    expect(offers.url).toBe('https://zapletane.sk/products/pletena-deka-orava')
    expect(String(offers.priceValidUntil)).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(jsonLd.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'Materiál', value: '100 % merino vlna' },
    ])
    expect(jsonLd.weight).toEqual({
      '@type': 'QuantitativeValue',
      unitCode: 'GRM',
      unitText: 'g',
      value: 1400,
    })
  })

  it('escapuje `<`, aby `</script>` v texte neukončilo blok', () => {
    const serialized = serializeJsonLd({ description: 'a </script> b' })

    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized).description).toBe('a </script> b')
  })
})
