import type { Product } from '@/payload-types'

type Row = {
  label: string
  value: string
}

/**
 * PDP „Vlastnosti" section — a two-column spec table built from the Y1 data
 * shapes on `products`: freeform `properties[].property` (relation to
 * `product-properties`, rendered "value + unit") plus the `dimensions` group
 * (width/height/depth in cm, `weight` in grams, nested at `dimensions.weight`).
 *
 * Row-level: a property row only renders when its relation is populated
 * (depth >= 1 — the PDP query already runs depth: 3) and has a value. Weight
 * is shown in grams under 1000g, otherwise in kg with one decimal
 * (Slovak comma). Renders nothing when there is no data at all, so callers
 * don't need to guard the empty case themselves.
 */
export function ProductProperties({ product }: { product: Product }) {
  const rows: Row[] = []

  for (const entry of product.properties || []) {
    if (!entry || typeof entry.property !== 'object' || !entry.value) continue

    const { name, unit } = entry.property
    if (!name) continue

    rows.push({ label: name, value: unit ? `${entry.value} ${unit}` : entry.value })
  }

  const { width, height, depth, weight } = product.dimensions || {}

  if (typeof width === 'number') rows.push({ label: 'Šírka', value: `${width} cm` })
  if (typeof height === 'number') rows.push({ label: 'Výška', value: `${height} cm` })
  if (typeof depth === 'number') rows.push({ label: 'Hĺbka', value: `${depth} cm` })
  if (typeof weight === 'number') {
    rows.push({
      label: 'Hmotnosť',
      value: weight >= 1000 ? `${(weight / 1000).toFixed(1).replace('.', ',')} kg` : `${weight} g`,
    })
  }

  if (!rows.length) return null

  return (
    <section className="section-band border-t border-gray-100 bg-white">
      <div className="container-editorial">
        <p className="eyebrow">Technické údaje</p>
        <h2 className="section-h2 mt-4">Vlastnosti</h2>
        <div className="section-decorator mt-6" />

        <table className="mt-10 w-full max-w-[640px] border-collapse overflow-hidden rounded-default border border-gray-100 bg-white text-sm">
          <tbody>
            {rows.map((row, index) => (
              <tr className={index !== 0 ? 'border-t border-gray-100' : undefined} key={row.label}>
                <th
                  className="w-1/2 px-5 py-3.5 text-left font-sans text-sm font-medium text-gray-600"
                  scope="row"
                >
                  {row.label}
                </th>
                <td className="px-5 py-3.5 text-right font-tech text-sm font-bold text-black">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
