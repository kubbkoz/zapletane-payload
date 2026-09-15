import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/utilities/cn'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Props = {
  /** Optional element rendered in the header, right-aligned (a link, a modal trigger…). */
  action?: ReactNode
  children?: ReactNode
  className?: string
  /** Bottom CTA label — rendered only together with `href`. */
  cta?: string
  description?: string
  /** Bottom CTA target. */
  href?: string
  icon?: LucideIcon
  title: string
}

/**
 * The single card shell of the account section (ZAPLETANE card recipe: white
 * surface, hairline gray-100 border, `rounded-default`, soft shadow).
 *
 * Server component on purpose — every account screen renders its data on the
 * server, so nothing here needs to ship to the browser.
 */
export const AccountCard: React.FC<Props> = ({
  action,
  children,
  className,
  cta,
  description,
  href,
  icon: Icon,
  title,
}) => {
  return (
    <section
      className={cn(
        'flex flex-col rounded-default border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:p-8',
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-default bg-brand-100 text-brand">
              <Icon className="size-4" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-sans text-base font-black uppercase tracking-wide text-black sm:text-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-1 font-sans text-[13px] leading-snug text-gray-500">{description}</p>
            )}
          </div>
        </div>

        {action}
      </div>

      {children && <div className="min-w-0 grow">{children}</div>}

      {href && cta && (
        <div className="mt-6">
          <Link
            href={href}
            className="group inline-flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:text-brand"
          >
            {cta}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      )}
    </section>
  )
}
