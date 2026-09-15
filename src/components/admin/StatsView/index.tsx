import type { DocumentViewServerProps } from 'payload'

import React from 'react'

import type { AdminStats, ProductRow } from '../stats/data'

import { checkRole } from '@/access/utilities'

import { getAdminStats } from '../stats/data'
import {
  formatChange,
  formatCount,
  formatDateTime,
  formatEur,
  formatEurCompact,
  formatPercent,
} from '../stats/format'

import '../stats/stats.scss'

const baseClass = 'zap-stats'

/**
 * Stránka „Štatistiky“ (Z8).
 *
 * Registrovaná ako ROOT edit view globalu `statistiky`
 * (`admin.components.views.edit.root.Component` — pozri src/globals/Statistics.ts),
 * takže nahrádza celé telo dokumentu vrátane hlavičky, záložiek a tlačidla
 * Uložiť. Global sám nedrží žiadne dáta; existuje len preto, aby Payload
 * vyrobil natívnu položku v navigácii v skupine „Ecommerce“.
 *
 * Prístup: admin panel už vyžaduje prihlásenie a `access.read` globalu je
 * `adminOnly`, takže sem sa bez role admina nedá dostať. Kontrola nižšie je
 * druhá vrstva — view číta cez Local API s `overrideAccess`, a taký kód sa
 * nemá spoliehať výlučne na to, že ho router pustil.
 */
export const StatsView: React.FC<DocumentViewServerProps> = async ({ initPageResult }) => {
  const user = initPageResult?.req?.user

  if (!checkRole(['admin'], user)) {
    return (
      <div className={baseClass} style={{ padding: 'var(--gutter-h)' }}>
        <div className={`${baseClass}__empty`}>
          <span className={`${baseClass}__empty-title`}>Prístup zamietnutý</span>
          <p className={`${baseClass}__note`}>
            Štatistiky obchodu vidia iba používatelia s rolou „admin“.
          </p>
        </div>
      </div>
    )
  }

  const stats = await getAdminStats()

  return (
    <div className={baseClass} style={{ padding: 'var(--gutter-h)' }}>
      <header className={`${baseClass}__header`}>
        <h1 className={`${baseClass}__title`}>Štatistiky</h1>
        <p className={`${baseClass}__meta`}>
          Prepočítané {formatDateTime(stats.generatedAt)} · údaje sa obnovujú každých 5 minút
        </p>
      </header>

      {!stats.hasData ? (
        <div className={`${baseClass}__empty`}>
          <span className={`${baseClass}__empty-title`}>Zatiaľ žiadne dáta</span>
          <p className={`${baseClass}__note`}>
            Štatistiky sa naplnia s prvými objednávkami.
          </p>
        </div>
      ) : (
        <>
          <Overview stats={stats} />
          <SalesOverTime stats={stats} />
          <PerformanceTable
            caption="Výkon produktov"
            emptyLabel="Objednávky zatiaľ neobsahujú žiadnu položku."
            firstColumn="Produkt"
            note={
              stats.revenueIsEstimated
                ? 'Tržby za položky sú odhad z aktuálnych cien — objednávka si jednotkovú cenu položky neukladá. Podiel je počítaný z tohto odhadu.'
                : undefined
            }
            rows={stats.products}
          />
          <PerformanceTable
            caption="Výkon kategórií"
            emptyLabel="Predané produkty zatiaľ nepatria do žiadnej kategórie."
            firstColumn="Kategória"
            note="Produkt zaradený do viacerých kategórií sa započíta do každej z nich."
            rows={stats.categories}
          />
          <OrderStatuses stats={stats} />
          <Payments stats={stats} />
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const Overview: React.FC<{ stats: AdminStats }> = ({ stats }) => {
  const { totals, trend } = stats
  const trendModifier = trend.changePct === null ? '' : trend.changePct >= 0 ? '--up' : '--down'

  return (
    <section className={`${baseClass}__section`}>
      <h2 className={`${baseClass}__section-title`}>Prehľad</h2>

      <div className={`${baseClass}__tiles`}>
        <Tile
          hint={`Súčet všetkých objednávok bez ohľadu na stav`}
          label="Celkové tržby"
          value={formatEur(totals.revenue)}
        />
        <Tile
          hint={stats.truncated ? 'Počíta sa z najnovších 5 000 objednávok' : 'Všetky objednávky'}
          label="Počet objednávok"
          value={formatCount(totals.orders)}
        />
        <Tile
          hint="Tržby ÷ počet objednávok"
          label="Priemerná objednávka"
          value={formatEur(totals.averageOrder)}
        />
        <Tile
          hint={`registrovaných zákazníckych účtov: ${formatCount(totals.registeredCustomers)}`}
          label="Zákazníci s objednávkou"
          value={formatCount(totals.customers)}
        />
        <Tile
          hint={`predchádzajúcich 30 dní: ${formatEur(trend.previous)}`}
          label="Tržby za 30 dní"
          value={formatEur(trend.current)}
        >
          <span className={`${baseClass}__trend ${baseClass}__trend${trendModifier}`}>
            {formatChange(trend.changePct)}
          </span>
        </Tile>
      </div>
    </section>
  )
}

const Tile: React.FC<{
  children?: React.ReactNode
  hint?: string
  label: string
  value: string
}> = ({ children, hint, label, value }) => (
  <div className={`${baseClass}__tile`}>
    <span className={`${baseClass}__tile-label`}>{label}</span>
    <span className={`${baseClass}__tile-value`}>{value}</span>
    {children}
    {hint ? <span className={`${baseClass}__tile-hint`}>{hint}</span> : null}
  </div>
)

/* -------------------------------------------------------------------------- */

const SalesOverTime: React.FC<{ stats: AdminStats }> = ({ stats }) => {
  const maxRevenue = Math.max(...stats.weeks.map((week) => week.revenue), 0)

  return (
    <section className={`${baseClass}__section`}>
      <h2 className={`${baseClass}__section-title`}>Predaje v čase</h2>

      <div className={`${baseClass}__card`}>
        <div className={`${baseClass}__chart`}>
          {stats.weeks.map((week) => {
            const height = maxRevenue > 0 ? Math.round((week.revenue / maxRevenue) * 100) : 0

            return (
              <div
                className={`${baseClass}__col`}
                key={week.start}
                title={`Týždeň od ${week.label} — ${formatEur(week.revenue)}, ${formatCount(week.orders)} obj.`}
              >
                <span className={`${baseClass}__bar-count`}>{week.orders || '·'}</span>
                <span className={`${baseClass}__bar-track`}>
                  <span
                    className={`${baseClass}__bar${week.revenue > 0 ? '' : ` ${baseClass}__bar--empty`}`}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className={`${baseClass}__bar-label`}>{week.label}</span>
              </div>
            )
          })}
        </div>

        <p className={`${baseClass}__note`}>
          Posledných 12 týždňov (od pondelka). Stĺpec = tržby, číslo nad ním = počet objednávok.
          Najvyšší stĺpec zodpovedá {formatEurCompact(maxRevenue)}.
        </p>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

const PerformanceTable: React.FC<{
  caption: string
  emptyLabel: string
  firstColumn: string
  note?: string
  rows: ProductRow[]
}> = ({ caption, emptyLabel, firstColumn, note, rows }) => (
  <section className={`${baseClass}__section`}>
    <h2 className={`${baseClass}__section-title`}>{caption}</h2>

    <div className={`${baseClass}__card`}>
      {rows.length === 0 ? (
        <p className={`${baseClass}__note`}>{emptyLabel}</p>
      ) : (
        <div className={`${baseClass}__table-wrap`}>
          <table className={`${baseClass}__table ${baseClass}__table--numeric`}>
            <thead>
              <tr>
                <th scope="col">{firstColumn}</th>
                <th scope="col">Predané kusy</th>
                <th scope="col">Tržby</th>
                <th scope="col">Podiel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {row.title}
                    <span className={`${baseClass}__share`}>
                      <span
                        className={`${baseClass}__share-fill`}
                        style={{ width: `${Math.min(100, Math.max(1, row.share))}%` }}
                      />
                    </span>
                  </td>
                  <td>{formatCount(row.quantity)}</td>
                  <td>{formatEur(row.revenue)}</td>
                  <td>{formatPercent(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {note ? <p className={`${baseClass}__note`}>{note}</p> : null}
    </div>
  </section>
)

/* -------------------------------------------------------------------------- */

const OrderStatuses: React.FC<{ stats: AdminStats }> = ({ stats }) => (
  <section className={`${baseClass}__section`}>
    <h2 className={`${baseClass}__section-title`}>Stavy objednávok</h2>

    <div className={`${baseClass}__card`}>
      <div className={`${baseClass}__chips`}>
        {stats.statuses.map((status) => (
          <span
            className={`${baseClass}__chip ${baseClass}__chip--${status.key}`}
            key={status.key}
          >
            {status.label}
            <span className={`${baseClass}__chip-count`}>{formatCount(status.count)}</span>
          </span>
        ))}
      </div>
    </div>
  </section>
)

/* -------------------------------------------------------------------------- */

const Payments: React.FC<{ stats: AdminStats }> = ({ stats }) => (
  <section className={`${baseClass}__section`}>
    <h2 className={`${baseClass}__section-title`}>Platby</h2>

    <div className={`${baseClass}__card`}>
      <div className={`${baseClass}__chips`}>
        <span className={`${baseClass}__chip ${baseClass}__chip--completed`}>
          Zaplatené
          <span className={`${baseClass}__chip-count`}>
            {formatCount(stats.payment.paidOrders)}
          </span>
        </span>
        <span className={`${baseClass}__chip`}>
          Bez potvrdenej platby
          <span className={`${baseClass}__chip-count`}>
            {formatCount(stats.payment.unpaidOrders)}
          </span>
        </span>
      </div>

      <div className={`${baseClass}__table-wrap`}>
        <table className={`${baseClass}__table ${baseClass}__table--numeric`}>
          <thead>
            <tr>
              <th scope="col">Typ platby</th>
              <th scope="col">Objednávky</th>
              <th scope="col">Tržby</th>
              <th scope="col">Zaplatené</th>
            </tr>
          </thead>
          <tbody>
            {stats.payments.map((payment) => (
              <tr key={payment.key}>
                <td>{payment.label}</td>
                <td>{formatCount(payment.orders)}</td>
                <td>{formatEur(payment.revenue)}</td>
                <td>{formatCount(payment.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={`${baseClass}__note`}>
        „Zaplatené“ = objednávka má transakciu v stave „succeeded“. Objednávky na dobierku a
        bankový prevod zadané bez platobnej brány transakciu nemajú, kým ju niekto nevytvorí.
      </p>
    </div>
  </section>
)
