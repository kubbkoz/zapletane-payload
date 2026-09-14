import type { Footer as FooterType } from '@/payload-types'

import { FooterMenu } from '@/components/Footer/menu'
import { Logo } from '@/components/Logo'
import { CONTACT } from '@/lib/contact'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { Facebook, Instagram, Mail, Phone, RotateCcw, Youtube } from 'lucide-react'
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
 * Links in the second column come from the `footer` global, which replaces the
 * original's four hard-coded Shopware category IDs.
 */
export async function Footer() {
  const footer: FooterType = await getCachedGlobal('footer', 1)()
  const navItems = footer?.navItems || []

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
                U nás nájdete ručne pletené deky a hračky, prútené dekorácie aj doplnky do
                domácnosti. Každý kúsok vzniká s láskou a trpezlivosťou.
              </p>

              <div className="flex items-center gap-3">
                <a
                  aria-label="Sledujte nás na Facebooku"
                  className="icon-ring h-11 w-11 hover:border-accent hover:bg-accent hover:text-white"
                  href={CONTACT.social.facebook}
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  aria-label="Sledujte nás na Instagrame"
                  className="icon-ring h-11 w-11 hover:border-accent hover:bg-accent hover:text-white"
                  href={CONTACT.social.instagram}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  aria-label="Sledujte nás na Youtube"
                  className="icon-ring h-11 w-11 hover:border-accent hover:bg-accent hover:text-white"
                  href={CONTACT.social.youtube}
                >
                  <Youtube className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* 2. Quick links (footer global) */}
            <div className="lg:col-span-2">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                Kategórie
              </h2>
              <FooterMenu menu={navItems} />
            </div>

            {/* 3. Contact */}
            <div className="lg:col-span-3">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                Kontakt
              </h2>
              <ul className="space-y-6">
                <li className="group flex items-start">
                  <Phone className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      Infolinka
                    </span>
                    <a
                      className="font-tech text-xl font-bold text-white transition-colors group-hover:text-accent"
                      href={CONTACT.phone.href}
                    >
                      {CONTACT.phone.display}
                    </a>
                  </div>
                </li>
                <li className="group flex items-start">
                  <Mail className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      Email
                    </span>
                    <a
                      className="text-base text-gray-300 transition-colors group-hover:text-white"
                      href={CONTACT.email.href}
                    >
                      {CONTACT.email.info}
                    </a>
                  </div>
                </li>
                <li className="group flex items-start">
                  <RotateCcw className="mr-4 mt-1 h-5 w-5 text-accent" />
                  <div>
                    <span className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-white/60">
                      Reklamácia / Vrátenie
                    </span>
                    <Link
                      className="text-base text-gray-300 transition-colors group-hover:text-accent"
                      href="/odstupenie-od-zmluvy"
                    >
                      Vyplniť formulár
                    </Link>
                  </div>
                </li>
              </ul>
            </div>

            {/* 4. Online support */}
            <div className="lg:col-span-3">
              <h2 className="footer-heading">
                <span className="mr-3 h-4 w-1 bg-accent" />
                Zákaznícka podpora
              </h2>

              <p className="mb-4 text-sm text-gray-300">
                Sme tu pre vás každý pracovný deň a radi poradíme s výberom toho pravého.
              </p>

              <a
                className="inline-flex items-center text-sm font-bold uppercase tracking-widest text-accent transition-colors hover:text-white"
                href={CONTACT.email.href}
              >
                <Mail className="mr-2 h-4 w-4" /> {CONTACT.email.info}
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 text-[10px] font-normal uppercase tracking-wider text-white/55 md:flex-row">
            <p>&copy; {new Date().getFullYear()} Zapletane. Všetky práva vyhradené.</p>
            <CookiePreferencesButton />
          </div>
        </div>
      </div>
    </footer>
  )
}
