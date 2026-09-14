import { ArrowUpRight, ExternalLink, Package, Settings2, ShoppingBag } from 'lucide-react'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

/**
 * ZAPLETANE welcome card, rendered above the dashboard
 * (`admin.components.beforeDashboard`).
 *
 * Replaces the Payload ecommerce-template banner (seed button + English
 * getting-started links). Styling is driven entirely by the theme variables set
 * in src/app/(payload)/custom.scss, so it follows the light/black theme switch
 * without any per-theme markup.
 *
 * Note: src/components/BeforeDashboard/SeedButton is intentionally left on disk
 * but no longer rendered — the template's demo seed is not ZAPLETANE content.
 * The POST /next/seed route it called still exists if it is ever needed.
 */

type QuickLink = {
  description: string
  href: string
  Icon: typeof Package
  label: string
}

const quickLinks: QuickLink[] = [
  {
    description: 'Katalóg, ceny, varianty a fotografie',
    href: '/admin/collections/products',
    Icon: Package,
    label: 'Produkty',
  },
  {
    description: 'Prehľad objednávok a ich stav',
    href: '/admin/collections/orders',
    Icon: ShoppingBag,
    label: 'Objednávky',
  },
  {
    description: 'Doprava, kontakty a texty webu',
    href: '/admin/globals/site-settings',
    Icon: Settings2,
    label: 'Nastavenia webu',
  },
]

export const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <div className={`${baseClass}__card`}>
        <div className={`${baseClass}__intro`}>
          <span className={`${baseClass}__eyebrow`}>Administrácia</span>
          <h2 className={`${baseClass}__title`}>Vitajte v administrácii ZAPLETANE</h2>
          <p className={`${baseClass}__lead`}>
            Spravujte katalóg, objednávky a obsah webu na jednom mieste. Začnite jedným z rýchlych
            odkazov nižšie.
          </p>
        </div>

        <nav aria-label="Rýchle odkazy" className={`${baseClass}__links`}>
          {quickLinks.map(({ description, href, Icon, label }) => (
            <a className={`${baseClass}__link`} href={href} key={href}>
              <span className={`${baseClass}__link-icon`}>
                <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
              </span>
              <span className={`${baseClass}__link-body`}>
                <span className={`${baseClass}__link-label`}>{label}</span>
                <span className={`${baseClass}__link-description`}>{description}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className={`${baseClass}__link-arrow`}
                size={16}
                strokeWidth={1.75}
              />
            </a>
          ))}
        </nav>

        <p className={`${baseClass}__footnote`}>
          <ExternalLink aria-hidden="true" size={14} strokeWidth={1.75} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" rel="noopener noreferrer" target="_blank">
            Otvoriť web v novom okne
          </a>
        </p>
      </div>
    </div>
  )
}
