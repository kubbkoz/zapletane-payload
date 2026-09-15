import type { ServerProps } from 'payload'

import React from 'react'

import { checkRole } from '@/access/utilities'

import { getAdminStats, WEEKS_IN_CHART } from '../stats/data'
import { formatChange, formatCount, formatEur, formatEurCompact } from '../stats/format'

import '../stats/stats.scss'

const baseClass = 'zap-stats-summary'
const statsClass = 'zap-stats'

/** Rozmery minigrafu vo vnútorných jednotkách SVG — škáluje sa cez viewBox. */
const SPARK_WIDTH = 260
const SPARK_HEIGHT = 72
const SPARK_GAP = 4

/**
 * Kompaktné štatistiky na nástenke admina (Z8).
 *
 * Tretí prvok v `admin.components.beforeDashboard` — teda pod „Poslednými
 * objednávkami“ a nad predvolenými kartami kolekcií.
 *
 * Štyri dlaždice + minigraf 12 týždňov. Minigraf je inline SVG bez textu:
 * `viewBox` + `width: 100%` ho spraví responzívnym a keďže v ňom nie sú
 * popisky, zmenšovanie mu nič nerozbije (veľký graf na stránke „Štatistiky“ je
 * naopak z CSS stĺpcov, aby popisky zostali čitateľné).
 *
 * Dáta sú tá istá cachovaná agregácia ako v `RecentOrders` a `StatsView`.
 */
export const StatsSummary: React.FC<ServerProps> = async ({ user }) => {
  if (!checkRole(['admin'], user)) return null

  const stats = await getAdminStats()

  const maxRevenue = Math.max(...stats.weeks.map((week) => week.revenue), 0)
  const barWidth = (SPARK_WIDTH - SPARK_GAP * (WEEKS_IN_CHART - 1)) / WEEKS_IN_CHART
  const trendModifier =
    stats.trend.changePct === null ? '' : stats.trend.changePct >= 0 ? '--up' : '--down'

  return (
    <div className={`${statsClass} ${baseClass}`}>
      <div className={`${baseClass}__head`}>
        <h2 className={`${statsClass}__section-title`}>Štatistiky</h2>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={`${statsClass}__link`} href="/admin/globals/statistiky">
          Zobraziť všetky štatistiky →
        </a>
      </div>

      {!stats.hasData ? (
        <div className={`${statsClass}__empty`}>
          <span className={`${statsClass}__empty-title`}>Zatiaľ žiadne dáta</span>
          <p className={`${statsClass}__note`}>
            Štatistiky sa naplnia s prvými objednávkami.
          </p>
        </div>
      ) : (
        <div className={`${baseClass}__body`}>
          <div className={`${statsClass}__tiles`}>
            <div className={`${statsClass}__tile`}>
              <span className={`${statsClass}__tile-label`}>Celkové tržby</span>
              <span className={`${statsClass}__tile-value`}>{formatEur(stats.totals.revenue)}</span>
            </div>
            <div className={`${statsClass}__tile`}>
              <span className={`${statsClass}__tile-label`}>Objednávky</span>
              <span className={`${statsClass}__tile-value`}>
                {formatCount(stats.totals.orders)}
              </span>
            </div>
            <div className={`${statsClass}__tile`}>
              <span className={`${statsClass}__tile-label`}>Priemerná objednávka</span>
              <span className={`${statsClass}__tile-value`}>
                {formatEur(stats.totals.averageOrder)}
              </span>
            </div>
            <div className={`${statsClass}__tile`}>
              <span className={`${statsClass}__tile-label`}>Tržby za 30 dní</span>
              <span className={`${statsClass}__tile-value`}>{formatEur(stats.trend.current)}</span>
              <span className={`${statsClass}__trend ${statsClass}__trend${trendModifier}`}>
                {formatChange(stats.trend.changePct)}
              </span>
            </div>
          </div>

          <div className={`${baseClass}__spark`}>
            <span className={`${statsClass}__tile-label`}>Posledných 12 týždňov</span>
            <svg
              aria-label={`Tržby za posledných ${WEEKS_IN_CHART} týždňov, maximum ${formatEurCompact(maxRevenue)}`}
              role="img"
              viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
            >
              {stats.weeks.map((week, index) => {
                const height =
                  maxRevenue > 0 ? Math.max(2, (week.revenue / maxRevenue) * SPARK_HEIGHT) : 2

                return (
                  <rect
                    className={`${baseClass}__spark-bar${
                      week.revenue > 0 ? '' : ` ${baseClass}__spark-bar--empty`
                    }`}
                    height={height}
                    key={week.start}
                    rx={2}
                    width={barWidth}
                    x={index * (barWidth + SPARK_GAP)}
                    y={SPARK_HEIGHT - height}
                  >
                    <title>{`${week.label} — ${formatEur(week.revenue)}`}</title>
                  </rect>
                )
              })}
            </svg>
            <span className={`${statsClass}__tile-hint`}>
              Maximum {formatEurCompact(maxRevenue)} · spolu{' '}
              {formatCount(stats.weeks.reduce((sum, week) => sum + week.orders, 0))} objednávok
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
