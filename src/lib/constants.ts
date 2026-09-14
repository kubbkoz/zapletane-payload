export type SortFilterItem = {
  reverse: boolean
  slug: null | string
  title: string
}

// Slovak-first storefront — sort labels are user-facing copy (DESIGN-SPEC §5).
export const defaultSort: SortFilterItem = {
  slug: null,
  reverse: false,
  title: 'Abecedne A–Z',
}

export const sorting: SortFilterItem[] = [
  defaultSort,
  { slug: '-createdAt', reverse: true, title: 'Najnovšie' },
  { slug: 'priceInEUR', reverse: false, title: 'Cena: od najnižšej' }, // asc
  { slug: '-priceInEUR', reverse: true, title: 'Cena: od najvyššej' },
]
