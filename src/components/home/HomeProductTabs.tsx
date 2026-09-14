'use client'

import React from 'react'

import { PRODUCT_TABS } from '@/lib/homeDefaults'
import { cn } from '@/utilities/cn'

export type ProductTab = {
  key: string
  label: string
  content: React.ReactNode
}

type Props = {
  eyebrow?: string
  tabs: ProductTab[]
  titleBefore?: string
  titleHighlight?: string
}

/**
 * Tabbed product shelf (DESIGN-SPEC §3.1). Centred editorial header — kicker,
 * display H2 with one brand-brown word, decorator — then the tab row: quiet
 * letter-spaced labels with an underline that turns brand brown when active
 * (horizontally scrollable on mobile, centred on desktop), then the shared
 * product-card grid.
 *
 * Each tab's cards are rendered on the server and handed in as `content`, so the
 * only thing that ships to the browser is the tab toggle.
 */
export const HomeProductTabs: React.FC<Props> = ({
  eyebrow = PRODUCT_TABS.eyebrow,
  tabs,
  titleBefore = PRODUCT_TABS.titleBefore,
  titleHighlight = PRODUCT_TABS.titleHighlight,
}) => {
  const [active, setActive] = React.useState(tabs[0]?.key)

  if (!tabs.length) return null

  const activeTab = tabs.find((tab) => tab.key === active) || tabs[0]

  return (
    <section className="section-band bg-brand-50" id="produkty">
      <div className="container-editorial">
        <div className="mb-8 text-center md:mb-10">
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h2 className="section-h2">
            {titleBefore ? `${titleBefore} ` : null}
            <span className="text-brand">{titleHighlight}</span>
          </h2>
          <div className="section-decorator mx-auto mb-6 mt-6" />

          {tabs.length > 1 && (
            <div className="scrollbar-hide flex justify-start overflow-x-auto md:justify-center">
              <div className="inline-flex items-center gap-6 whitespace-nowrap px-4 md:gap-10">
                {tabs.map((tab) => (
                  <button
                    className={cn(
                      'border-b py-2 font-sans text-[11px] font-medium uppercase tracking-[0.22em] transition-colors md:text-xs',
                      active === tab.key
                        ? 'border-brand text-brand'
                        : 'border-transparent text-gray-600 hover:text-black',
                    )}
                    key={tab.key}
                    onClick={() => setActive(tab.key)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4 lg:gap-6">
          {activeTab?.content}
        </div>
      </div>
    </section>
  )
}
