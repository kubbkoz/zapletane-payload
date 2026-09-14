import type { Footer as FooterType } from '@/payload-types'

import { FooterMenu } from '@/components/Footer/menu'
import { Logo } from '@/components/Logo'
import { SocialIcon } from '@/components/SocialIcon'
import { renderCopyright, resolveFooterContent } from '@/lib/footerDefaults'
import { isExternalHref, resolveSocialLinks } from '@/lib/navigation'
import { getContact } from '@/utilities/getContact'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { Mail, Phone, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { CookiePreferencesButton } from './CookiePreferencesButton'

/**
 * ZAPLETANE footer — 1:1 port of `app/components/layout/Footer.vue`
 * (DESIGN-SPEC.md §2.2).
 *
 * Espresso ink ground (`bg-black` = #241917) with the 1px accent gradient hair
 * line along its top edge, then a 12-column grid: brand + socials (4),
 * quick links (2), contact (3), support (3), and the uppercase bottom bar.
 *
 * Every string, the link column and the social list now come from the `footer`
 * global (cached under `global_footer`, revalidated by its afterChange hook);
 * phone / e-mail / business details come from `site-settings` via `getContact`.
 * `resolveFooterContent` falls back to the constants in
 * `src/lib/footerDefaults.ts` field by field, so an older footer row renders
 * exactly the copy it always did.
 */
export async function Footer() {
  const [footer, contact] = await Promise.all([
    getCachedGlobal('footer', 1)() as Promise<FooterType>,
    getContact(),
  ])

  const navItems = footer?.navItems || []
  const content = resolveFooterContent(footer)
  const socialLinks = resolveSocialLinks(footer)
  const businessDetails = content.contact.showBusinessDetails
    ? [
        contact.ico ? `IČO: ${contact.ico}` : null,
        contact.dic ? `DIČ: ${contact.dic}` : null,
        contact.icDph ? `IČ DPH: ${contact.icDph}` : null,
        contact.address,
        contact.openingHours,
      ].filter(Boolean)
    : []

  return (
    <footer className="relative overflow-hidden border-t border-zinc-900 bg-black font-sans text-white">
      {/* Top accent hairline */}
      <div className="absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

      <div className="pb-10 pt-20">
        <div className="container-page">
          <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
            {/* 1. Brand & socials */}
            <div className="flex flex-col items-start lg:col-span-4">
              <Logo className="mb-8" variant="light" />
              <p className="mb-8 max-w-sm text-sm leading-relaxed text-gray-300">
                {content.description}
              </p>

              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    aria-label={social.label}
                    className="icon-ring h-11 w-11 hover:border-accent hover:bg-accent hover:text-white"
                    href={social.url}
                    key={social.id}
                    {...(isExternalHref(social.url)
                      ? { rel: 'noopener noreferrer', target: '_blank' }
                      : {})}
                  >
                    <SocialIcon className="h-4 w-4" platform={social.platform} />
                  </a>
                ))}
              </div>
            </div>

            {/* 2. Quick links (footer global) */}
            <div className="lg:col-span-2">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                {content.navTitle}
              </h2>
              <FooterMenu menu={navItems} />
            </div>

            {/* 3. Contact */}
            <div className="lg:col-span-3">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                {content.contact.heading}
              </h2>
              <ul className="space-y-6">
                <li className="group flex items-start">
                  <Phone className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      {content.contact.phoneLabel}
                    </span>
                    <a
                      className="font-tech text-xl font-bold text-white transition-colors group-hover:text-accent"
                      href={contact.phone.href}
                    >
                      {contact.phone.display}
                    </a>
                  </div>
                </li>
                <li className="group flex items-start">
                  <Mail className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      {content.contact.emailLabel}
                    </span>
                    <a
                      className="text-base text-gray-300 transition-colors group-hover:text-white"
                      href={contact.email.href}
                    >
                      {contact.email.info}
                    </a>
                  </div>
                </li>
                <li className="group flex items-start">
                  <RotateCcw className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      {content.contact.returnsLabel}
                    </span>
                    <Link
                      className="text-base text-gray-300 transition-colors group-hover:text-accent"
                      href={content.contact.returnsHref}
                    >
                      {content.contact.returnsLinkLabel}
                    </Link>
                  </div>
                </li>
              </ul>

              {/* Business details — opt-in, and only when SiteSettings has them. */}
              {businessDetails.length ? (
                <ul className="mt-6 space-y-1 text-sm text-gray-400">
                  {businessDetails.map((detail) => (
                    <li className="whitespace-pre-line" key={detail as string}>
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* 4. Online support */}
            <div className="lg:col-span-3">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                {content.support.heading}
              </h2>

              <p className="mb-4 text-sm text-gray-300">{content.support.text}</p>

              <a
                className="inline-flex items-center text-sm font-bold uppercase tracking-widest text-accent transition-colors hover:text-white"
                href={contact.email.href}
              >
                <Mail className="mr-2 h-4 w-4" /> {contact.email.info}
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 text-[10px] font-normal uppercase tracking-wider text-white/55 md:flex-row">
            <p>{renderCopyright(content.bottomBar.copyright)}</p>
            <CookiePreferencesButton label={content.bottomBar.cookieButtonLabel} />
          </div>
        </div>
      </div>
    </footer>
  )
}
