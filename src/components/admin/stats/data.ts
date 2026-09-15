import type { Order } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

/**
 * Zdroj dát pre obe štatistické plochy v admine (Z8):
 *
 *   - `src/components/admin/StatsView`   — celá stránka „Štatistiky“
 *     (nahradený edit view globalu `statistiky`),
 *   - `src/components/admin/StatsSummary` + `src/components/admin/RecentOrders`
 *     — dlaždice a posledné objednávky nad nástenkou.
 *
 * Všetky tri komponenty čítajú JEDEN cachovaný výsledok (`getAdminStats`), takže
 * nástenka urobí jeden prechod objednávkami, nie tri.
 *
 * Výkon
 * -----
 * Agregácia sa počíta v JS nad načítanými dokumentmi — katalóg aj počet
 * objednávok tohto obchodu sú malé a Payload nemá SQL agregácie, ktoré by šli
 * cez oba adaptéry (sqlite lokálne, Postgres na Verceli) rovnako.
 *
 * Na jedno prepočítanie idú štyri dotazy:
 *   1. objednávky   — max `ORDER_SCAN_LIMIT` najnovších, `depth: 0`
 *   2. produkty     — `select` na title/cenu/kategórie, `depth: 0`
 *   3. varianty     — `select` na cenu/produkt, `depth: 0`
 *   4. kategórie    — `select` na názov
 *   (+ `count` registrovaných zákazníkov a `find` transakcií pre stav platby)
 *
 * Výsledok drží `unstable_cache` 300 s pod tagom `admin-stats`, takže bežné
 * preklikávanie v admine nespúšťa nový prechod. Objednávky zámerne NEMAJÚ
 * afterChange hook, ktorý by tag pri zmene zhodil — override kolekcie
 * `orders` patrí inému vlastníkovi a 5-minútové oneskorenie je pre prehľad
 * postačujúce.
 */

/** Tag pre `revalidateTag('admin-stats')`, ak by ho niekto neskôr chcel zhadzovať ručne. */
export const ADMIN_STATS_TAG = 'admin-stats'

/** Ako dlho (v sekundách) sa drží prepočítaná agregácia. */
export const ADMIN_STATS_TTL = 300

/**
 * Strop na počet prečítaných objednávok. Prehľad je nástroj pre majiteľa
 * malého obchodu, nie dátový sklad — pri prekročení sa počíta z posledných
 * `ORDER_SCAN_LIMIT` objednávok a UI to povie (`truncated`).
 */
const ORDER_SCAN_LIMIT = 5000

/** Koľko týždňov zobrazuje graf „Predaje v čase“. */
export const WEEKS_IN_CHART = 12

/** Počet objednávok v karte „Posledné objednávky“ na nástenke. */
const RECENT_ORDERS_COUNT = 8

const DAY_MS = 86_400_000

export type OrderStatusKey = 'cancelled' | 'completed' | 'processing' | 'refunded'

export type PaymentTypeKey = 'bankTransfer' | 'card' | 'cod' | 'unknown'

export type WeekBucket = {
  /** ISO dátum pondelka daného týždňa (kľúč do zoznamu). */
  start: string
  /** Krátky slovenský popis, napr. „15. 9.“. */
  label: string
  orders: number
  /** V eurocentoch. */
  revenue: number
}

export type ProductRow = {
  id: number | string
  title: string
  quantity: number
  /** V eurocentoch, odhad — pozri `revenueIsEstimated`. */
  revenue: number
  /** Podiel na odhadovaných tržbách z položiek, v percentách. */
  share: number
}

export type CategoryRow = ProductRow

export type StatusRow = {
  key: OrderStatusKey | 'unknown'
  label: string
  count: number
}

export type PaymentRow = {
  key: PaymentTypeKey
  label: string
  orders: number
  /** V eurocentoch. */
  revenue: number
  /** Objednávky s úspešnou transakciou. */
  paid: number
}

export type RecentOrderRow = {
  id: number | string
  createdAt: string
  customerEmail: string
  /** V eurocentoch. */
  amount: number
  status: OrderStatusKey | 'unknown'
  statusLabel: string
}

export type AdminStats = {
  /** Žiadna objednávka = prázdny stav vo všetkých komponentoch. */
  hasData: boolean
  /** Objednávok bolo viac ako `ORDER_SCAN_LIMIT` — počíta sa z najnovších. */
  truncated: boolean
  /** Tržby položiek sa odhadujú z aktuálnych cien — objednávka si cenu neukladá. */
  revenueIsEstimated: boolean
  totals: {
    /** Súčet `orders.amount` vo všetkých stavoch, v eurocentoch. */
    revenue: number
    orders: number
    /** Priemerná hodnota objednávky v eurocentoch. */
    averageOrder: number
    /** Zákazníci, ktorí aspoň raz objednali (podľa účtu, inak podľa e-mailu). */
    customers: number
    /** Registrované účty s rolou „customer“. */
    registeredCustomers: number
  }
  trend: {
    /** Tržby za posledných 30 dní, v eurocentoch. */
    current: number
    /** Tržby za predchádzajúcich 30 dní, v eurocentoch. */
    previous: number
    /** Percentuálna zmena; `null` = predchádzajúce obdobie bolo nulové. */
    changePct: null | number
  }
  weeks: WeekBucket[]
  products: ProductRow[]
  categories: CategoryRow[]
  statuses: StatusRow[]
  payments: PaymentRow[]
  payment: {
    paidOrders: number
    unpaidOrders: number
  }
  recentOrders: RecentOrderRow[]
  /** ISO čas prepočtu — v UI ako „Prepočítané …“. */
  generatedAt: string
}

export const STATUS_LABELS: Record<OrderStatusKey | 'unknown', string> = {
  cancelled: 'Zrušená',
  completed: 'Doručená',
  processing: 'Spracováva sa',
  refunded: 'Vrátená',
  unknown: 'Bez stavu',
}

export const PAYMENT_LABELS: Record<PaymentTypeKey, string> = {
  bankTransfer: 'Bankový prevod',
  card: 'Platba kartou',
  cod: 'Dobierka',
  unknown: 'Neuvedené',
}

/** Poradie stavov v riadku „čipov“ — od najčastejšieho k najmenej želanému. */
const STATUS_ORDER: (OrderStatusKey | 'unknown')[] = [
  'processing',
  'completed',
  'cancelled',
  'refunded',
  'unknown',
]

const PAYMENT_ORDER: PaymentTypeKey[] = ['cod', 'bankTransfer', 'card', 'unknown']

const weekLabelFormatter = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric' })

/** Pondelok 00:00 miestneho času pre daný dátum. */
const startOfWeek = (input: Date): Date => {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  // getDay(): 0 = nedeľa. Posun na pondelok ako začiatok týždňa.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

const toNumber = (value: unknown): number => (typeof value === 'number' && !isNaN(value) ? value : 0)

/** Z relačného poľa (`number | Doc | null`) vytiahne id. */
const relationID = (value: unknown): null | number | string => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: number | string }).id
    return id ?? null
  }
  return null
}

const computeAdminStats = async (): Promise<AdminStats> => {
  const payload = await getPayload({ config: configPromise })

  const [ordersResult, productsResult, variantsResult, categoriesResult, transactionsResult] =
    await Promise.all([
      payload.find({
        collection: 'orders',
        depth: 0,
        limit: ORDER_SCAN_LIMIT,
        overrideAccess: true,
        sort: '-createdAt',
      }),
      payload.find({
        collection: 'products',
        depth: 0,
        limit: 1000,
        overrideAccess: true,
        select: { categories: true, priceInEUR: true, title: true },
      }),
      payload.find({
        collection: 'variants',
        depth: 0,
        limit: 2000,
        overrideAccess: true,
        select: { priceInEUR: true, product: true },
      }),
      payload.find({
        collection: 'categories',
        depth: 0,
        limit: 500,
        overrideAccess: true,
        select: { title: true },
      }),
      payload.find({
        collection: 'transactions',
        depth: 0,
        limit: ORDER_SCAN_LIMIT,
        overrideAccess: true,
        select: { order: true, status: true },
      }),
    ])

  // Registrovaní zákazníci sa počítajú v databáze (count), nie prechodom cez
  // dokumenty — zoznam používateľov je jediná vec, ktorá môže reálne narásť.
  let registeredCustomers = 0
  try {
    const counted = await payload.count({
      collection: 'users',
      overrideAccess: true,
      where: { roles: { in: ['customer'] } },
    })
    registeredCustomers = counted.totalDocs
  } catch {
    // Roly sú `hasMany` select — keby sa tvar poľa niekedy zmenil, prehľad
    // nespadne, len túto jednu hodnotu neukáže.
    registeredCustomers = 0
  }

  const orders = ordersResult.docs as Order[]

  // --- pomocné mapy ------------------------------------------------------
  const productTitle = new Map<number | string, string>()
  const productPrice = new Map<number | string, number>()
  const productCategories = new Map<number | string, (number | string)[]>()

  for (const product of productsResult.docs) {
    const id = product.id
    productTitle.set(id, product.title || `Produkt #${id}`)
    productPrice.set(id, toNumber(product.priceInEUR))
    productCategories.set(
      id,
      (product.categories || [])
        .map((category) => relationID(category))
        .filter((value): value is number | string => value !== null),
    )
  }

  const variantPrice = new Map<number | string, number>()
  const variantParent = new Map<number | string, null | number | string>()

  for (const variant of variantsResult.docs) {
    variantPrice.set(variant.id, toNumber(variant.priceInEUR))
    variantParent.set(variant.id, relationID(variant.product))
  }

  // Kľúčom je String(id) — agregácia nižšie zlieva id kategórií do reťazcov,
  // aby sa k nim dal primiešať syntetický kľúč `__none__`.
  const categoryTitle = new Map<string, string>()
  for (const category of categoriesResult.docs) {
    categoryTitle.set(String(category.id), category.title || `Kategória #${category.id}`)
  }

  // Objednávky s aspoň jednou úspešnou transakciou = „zaplatené“.
  const paidOrderIDs = new Set<number | string>()
  for (const transaction of transactionsResult.docs) {
    if (transaction.status !== 'succeeded') continue
    const orderID = relationID(transaction.order)
    if (orderID !== null) paidOrderIDs.add(orderID)
  }

  // --- týždenné koše -----------------------------------------------------
  const now = new Date()
  const firstWeekStart = startOfWeek(now)
  firstWeekStart.setDate(firstWeekStart.getDate() - (WEEKS_IN_CHART - 1) * 7)

  const weeks: WeekBucket[] = []
  const weekIndex = new Map<string, number>()

  for (let i = 0; i < WEEKS_IN_CHART; i++) {
    const start = new Date(firstWeekStart)
    start.setDate(start.getDate() + i * 7)
    const key = start.toISOString().slice(0, 10)
    weekIndex.set(key, i)
    weeks.push({
      label: weekLabelFormatter.format(start),
      orders: 0,
      revenue: 0,
      start: key,
    })
  }

  // --- jeden prechod objednávkami ---------------------------------------
  const nowMs = now.getTime()
  const last30Start = nowMs - 30 * DAY_MS
  const prev30Start = nowMs - 60 * DAY_MS

  let totalRevenue = 0
  let currentWindowRevenue = 0
  let previousWindowRevenue = 0
  let paidOrders = 0

  const customerKeys = new Set<string>()
  const statusCounts = new Map<OrderStatusKey | 'unknown', number>()
  const paymentStats = new Map<PaymentTypeKey, { orders: number; paid: number; revenue: number }>()
  const productQuantity = new Map<number | string, number>()
  const productRevenue = new Map<number | string, number>()

  for (const order of orders) {
    const amount = toNumber(order.amount)
    totalRevenue += amount

    const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : NaN

    if (!isNaN(createdMs)) {
      if (createdMs >= last30Start) currentWindowRevenue += amount
      else if (createdMs >= prev30Start) previousWindowRevenue += amount

      const bucket = weekIndex.get(startOfWeek(new Date(createdMs)).toISOString().slice(0, 10))
      if (bucket !== undefined) {
        weeks[bucket]!.orders += 1
        weeks[bucket]!.revenue += amount
      }
    }

    const customerID = relationID(order.customer)
    const customerKey = customerID !== null ? `id:${customerID}` : `email:${order.customerEmail ?? ''}`
    if (customerKey !== 'email:') customerKeys.add(customerKey)

    const statusKey = (order.status ?? 'unknown') as OrderStatusKey | 'unknown'
    statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1)

    const isPaid = paidOrderIDs.has(order.id)
    if (isPaid) paidOrders += 1

    const paymentKey = (order.paymentType ?? 'unknown') as PaymentTypeKey
    const paymentBucket = paymentStats.get(paymentKey) ?? { orders: 0, paid: 0, revenue: 0 }
    paymentBucket.orders += 1
    paymentBucket.revenue += amount
    if (isPaid) paymentBucket.paid += 1
    paymentStats.set(paymentKey, paymentBucket)

    for (const item of order.items || []) {
      const quantity = toNumber(item.quantity)
      if (quantity <= 0) continue

      const variantID = relationID(item.variant)
      const directProductID = relationID(item.product)
      const productID =
        directProductID ?? (variantID !== null ? (variantParent.get(variantID) ?? null) : null)

      if (productID === null) continue

      // Položka objednávky si jednotkovú cenu neukladá (schéma pluginu je
      // product/variant/quantity), takže tržba za produkt je odhad z AKTUÁLNEJ
      // ceny. Variant má prednosť pred cenou produktu.
      const unitPrice =
        variantID !== null && variantPrice.has(variantID)
          ? variantPrice.get(variantID)!
          : (productPrice.get(productID) ?? 0)

      productQuantity.set(productID, (productQuantity.get(productID) ?? 0) + quantity)
      productRevenue.set(productID, (productRevenue.get(productID) ?? 0) + unitPrice * quantity)
    }
  }

  // --- odvodené tabuľky --------------------------------------------------
  const itemsRevenueTotal = [...productRevenue.values()].reduce((sum, value) => sum + value, 0)

  const products: ProductRow[] = [...productQuantity.keys()]
    .map((id) => {
      const revenue = productRevenue.get(id) ?? 0
      return {
        id,
        quantity: productQuantity.get(id) ?? 0,
        revenue,
        share: itemsRevenueTotal > 0 ? (revenue / itemsRevenueTotal) * 100 : 0,
        title: productTitle.get(id) ?? `Produkt #${id}`,
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 10)

  const categoryQuantity = new Map<string, number>()
  const categoryRevenue = new Map<string, number>()

  for (const [productID, quantity] of productQuantity) {
    const revenue = productRevenue.get(productID) ?? 0
    const categories = productCategories.get(productID) ?? []
    const keys = categories.length > 0 ? categories.map(String) : ['__none__']

    // Produkt v dvoch kategóriách sa započíta do oboch — súčet stĺpca preto
    // môže byť vyšší než celkové tržby; podiel je počítaný z tohto súčtu.
    for (const key of keys) {
      categoryQuantity.set(key, (categoryQuantity.get(key) ?? 0) + quantity)
      categoryRevenue.set(key, (categoryRevenue.get(key) ?? 0) + revenue)
    }
  }

  const categoriesRevenueTotal = [...categoryRevenue.values()].reduce((sum, value) => sum + value, 0)

  const categories: CategoryRow[] = [...categoryQuantity.keys()]
    .map((key) => {
      const revenue = categoryRevenue.get(key) ?? 0
      return {
        id: key,
        quantity: categoryQuantity.get(key) ?? 0,
        revenue,
        share: categoriesRevenueTotal > 0 ? (revenue / categoriesRevenueTotal) * 100 : 0,
        title: key === '__none__' ? 'Bez kategórie' : (categoryTitle.get(key) ?? `Kategória #${key}`),
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)

  const statuses: StatusRow[] = STATUS_ORDER.filter((key) => (statusCounts.get(key) ?? 0) > 0).map(
    (key) => ({ count: statusCounts.get(key) ?? 0, key, label: STATUS_LABELS[key] }),
  )

  const payments: PaymentRow[] = PAYMENT_ORDER.filter((key) => paymentStats.has(key)).map((key) => {
    const bucket = paymentStats.get(key)!
    return {
      key,
      label: PAYMENT_LABELS[key],
      orders: bucket.orders,
      paid: bucket.paid,
      revenue: bucket.revenue,
    }
  })

  const recentOrders: RecentOrderRow[] = orders.slice(0, RECENT_ORDERS_COUNT).map((order) => {
    const statusKey = (order.status ?? 'unknown') as OrderStatusKey | 'unknown'
    return {
      id: order.id,
      amount: toNumber(order.amount),
      createdAt: order.createdAt,
      customerEmail: order.customerEmail || '—',
      status: statusKey,
      statusLabel: STATUS_LABELS[statusKey],
    }
  })

  const orderCount = orders.length

  return {
    categories,
    generatedAt: new Date().toISOString(),
    hasData: orderCount > 0,
    payment: {
      paidOrders,
      unpaidOrders: orderCount - paidOrders,
    },
    payments,
    products,
    recentOrders,
    revenueIsEstimated: true,
    statuses,
    totals: {
      averageOrder: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      customers: customerKeys.size,
      orders: orderCount,
      registeredCustomers,
      revenue: totalRevenue,
    },
    trend: {
      changePct:
        previousWindowRevenue > 0
          ? ((currentWindowRevenue - previousWindowRevenue) / previousWindowRevenue) * 100
          : null,
      current: currentWindowRevenue,
      previous: previousWindowRevenue,
    },
    truncated: ordersResult.totalDocs > orderCount,
    weeks,
  }
}

/**
 * Cachovaný prepočet. Tag `admin-stats` + 300 s strop — rovnaká dvojica
 * mechanizmov ako pri globaloch (`src/utilities/getGlobals.ts`), len tu je
 * strop jediný, kto cache zhadzuje.
 */
export const getAdminStats = unstable_cache(computeAdminStats, ['admin-stats'], {
  revalidate: ADMIN_STATS_TTL,
  tags: [ADMIN_STATS_TAG],
})
