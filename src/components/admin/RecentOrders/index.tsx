import type { ServerProps } from 'payload'

import React from 'react'

import { checkRole } from '@/access/utilities'

import { getAdminStats } from '../stats/data'
import { formatDate, formatEur } from '../stats/format'

import '../stats/stats.scss'

const baseClass = 'zap-recent-orders'
const statsClass = 'zap-stats'

/**
 * „Posledné objednávky“ na nástenke admina (Z8).
 *
 * Druhý prvok v `admin.components.beforeDashboard` — poradie hero → objednávky
 * → štatistiky → predvolené karty drží to pole v src/payload.config.ts.
 *
 * Dáta berie z tej istej cachovanej agregácie ako stránka „Štatistiky“
 * (`getAdminStats`), takže nástenka nespustí druhý prechod objednávkami.
 *
 * Do admina sa dostane len používateľ s rolou admin (`Users.access.admin`),
 * kontrola nižšie je poistka pre prípad, že by sa to raz uvoľnilo.
 */
export const RecentOrders: React.FC<ServerProps> = async ({ user }) => {
  if (!checkRole(['admin'], user)) return null

  const stats = await getAdminStats()

  return (
    <div className={`${statsClass} ${baseClass}`}>
      <div className={`${statsClass}__card`}>
        <div className={`${baseClass}__head`}>
          <h2 className={`${statsClass}__section-title`}>Posledné objednávky</h2>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className={`${statsClass}__link`} href="/admin/collections/orders">
            Všetky objednávky →
          </a>
        </div>

        {stats.recentOrders.length === 0 ? (
          <p className={`${statsClass}__note`}>
            Zatiaľ žiadne objednávky — hneď ako príde prvá, objaví sa tu.
          </p>
        ) : (
          <div className={`${statsClass}__table-wrap`}>
            <table className={`${statsClass}__table`}>
              <thead>
                <tr>
                  <th scope="col">Číslo</th>
                  <th scope="col">Dátum</th>
                  <th scope="col">Zákazník</th>
                  <th className={`${statsClass}__num`} scope="col">
                    Suma
                  </th>
                  <th scope="col">Stav</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={String(order.id)}>
                    <td>
                      <a
                        className={`${baseClass}__row-link`}
                        href={`/admin/collections/orders/${order.id}`}
                      >
                        #{order.id}
                      </a>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{order.customerEmail}</td>
                    <td className={`${statsClass}__num`}>{formatEur(order.amount)}</td>
                    <td>
                      <span className={`${statsClass}__chip ${statsClass}__chip--${order.status}`}>
                        {order.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
