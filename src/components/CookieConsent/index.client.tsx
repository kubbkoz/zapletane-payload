'use client'

import React, { useEffect } from 'react'

import { COOKIE_PREFERENCES_EVENT, openCookiePreferences, publishConsentChange } from './consent'

// The plugin's own stylesheet first, our brand overrides second — the order of
// these two imports is what makes the overrides win, so do not reorder them.
import 'vanilla-cookieconsent/dist/cookieconsent.css'
import './cookieconsent.css'

type PluginConfig = Parameters<typeof import('vanilla-cookieconsent').run>[0]

/**
 * ZAPLETANE cookie banner — `vanilla-cookieconsent` v3 (orestbida), Slovak
 * only, opt-in.
 *
 * WHAT ACTUALLY GATES THE TRACKING TAGS
 * `manageScriptTags` (on by default in v3, set explicitly below because it is
 * the whole point of this component) makes the plugin collect every
 * `<script data-category="…">` in the document when `run()` executes, and
 * activate the ones whose category is consented: it strips `type="text/plain"`
 * (or restores `data-type`), clones the tag and replaces the inert one, at
 * which point the browser runs it. It re-runs that pass after every consent
 * change, so granting analytics in the preferences dialog starts the tags with
 * no page reload.
 *
 * `src/components/TrackingScripts/**` renders exactly those inert tags on the
 * server, so the snippet an admin pasted into `site-settings.marketing` is in
 * the DOM — parsed, visible to the plugin, and not executed — before this
 * component ever mounts. Mount order therefore does not matter: whenever
 * `run()` happens, it finds them.
 *
 * WHAT IT DOES NOT DO
 * No Google Consent Mode v2 signalling. GTM/GA/Pixel are blocked outright
 * until consent, which is the stricter baseline — there is nothing for a
 * `gtag('consent', 'denied')` call to tell a tag that never loaded.
 */
export function CookieConsentBanner() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const CookieConsent = await import('vanilla-cookieconsent')

      if (cancelled) return

      const publish = (categories: string[]) =>
        publishConsentChange({
          analytics: categories.includes('analytics'),
          functional: categories.includes('functional'),
        })

      const config: PluginConfig = {
        // `opt-in`: nothing but `necessary` runs until the shopper says so.
        mode: 'opt-in',
        // Intercept `<script data-category>` tags (default `true` — pinned
        // because the whole tracking gate depends on it).
        manageScriptTags: true,
        // Erase the cookies listed per category when it is switched off.
        autoClearCookies: true,
        autoShow: true,
        // The page stays usable behind the banner: a cookie wall is not
        // required here, and blocking the shop on first paint would cost more
        // than it protects.
        disablePageInteraction: false,
        // Crawlers never see (or consent to) the modal. Note for debugging:
        // this also covers `navigator.webdriver`, so an automated browser
        // needs that flag spoofed to see the banner at all.
        hideFromBots: true,

        categories: {
          necessary: {
            enabled: true,
            readOnly: true,
          },
          analytics: {
            autoClear: {
              cookies: [
                { name: /^_ga/ }, // GA4 client id + per-property state
                { name: '_gid' },
                { name: /^_gat/ },
                { name: '_fbp' }, // Meta Pixel browser id
                { name: '_fbc' }, // Meta click id
                { name: /^_hj/ },
              ],
            },
          },
          functional: {},
        },

        guiOptions: {
          consentModal: {
            // `box` bottom-left on desktop; below 640px the plugin turns it
            // into a full-width sheet on its own.
            layout: 'box',
            position: 'bottom left',
            equalWeightButtons: true,
            flipButtons: false,
          },
          preferencesModal: {
            layout: 'box',
            equalWeightButtons: true,
            flipButtons: false,
          },
        },

        language: {
          default: 'sk',
          translations: {
            sk: {
              consentModal: {
                title: 'Cookies na zapletane.sk',
                description:
                  'Nevyhnutné súbory cookies používame, aby web fungoval — košík, prihlásenie, ' +
                  'váš súhlas. S vaším povolením k nim pridáme aj meranie návštevnosti a ' +
                  'notifikácie o objednávkach. Rozhodnutie môžete kedykoľvek zmeniť.',
                acceptAllBtn: 'Prijať všetko',
                acceptNecessaryBtn: 'Odmietnuť',
                showPreferencesBtn: 'Nastavenia',
                closeIconLabel: 'Zavrieť a odmietnuť',
                label: 'Súhlas so súbormi cookies',
              },
              preferencesModal: {
                title: 'Nastavenia cookies',
                acceptAllBtn: 'Prijať všetko',
                acceptNecessaryBtn: 'Odmietnuť všetko',
                savePreferencesBtn: 'Uložiť nastavenia',
                closeIconLabel: 'Zavrieť',
                sections: [
                  {
                    description:
                      'Vyberte si, čo na zapletane.sk povolíte. Nevyhnutné cookies vypnúť ' +
                      'nemožno — bez nich by web nefungoval. Všetko ostatné je na vás a zmeniť ' +
                      'to môžete kedykoľvek cez odkaz „Nastavenia cookies" v pätičke.',
                  },
                  {
                    title: 'Nevyhnutné',
                    description:
                      'Držia váš košík medzi stránkami, udržia vás prihlásených a pamätajú si ' +
                      'samotný súhlas s cookies. Bez nich objednávku nedokončíte, preto sa ' +
                      'nedajú vypnúť.',
                    linkedCategory: 'necessary',
                  },
                  {
                    title: 'Analytické a marketingové',
                    description:
                      'Meranie návštevnosti a remarketing — Google Analytics / Google Tag ' +
                      'Manager a Meta Pixel. Ukazujú nám, ktoré produkty ľudí zaujímajú a čo na ' +
                      'webe nefunguje, a umožňujú zobraziť našu reklamu ľuďom, ktorí u nás už ' +
                      'boli. Kým to nepovolíte, tieto skripty sa vôbec nespustia.',
                    linkedCategory: 'analytics',
                  },
                  {
                    title: 'Funkčné',
                    description:
                      'Push notifikácie o objednávkach — upozornenie priamo v prehliadači, keď ' +
                      'sa zmení stav vašej objednávky. Bez tohto povolenia notifikácie ' +
                      'nezapneme a existujúce odhlásime.',
                    linkedCategory: 'functional',
                  },
                  {
                    title: 'Otázky k ochrane údajov?',
                    description:
                      'Napíšte nám na <a href="mailto:info@zapletane.sk">info@zapletane.sk</a>.',
                  },
                ],
              },
            },
          },
        },

        // Fires on the first consent *and* on every page load that already has
        // consent on file — so subscribers get the state without polling.
        onConsent: ({ cookie }) => publish(cookie.categories),
        onChange: ({ cookie }) => publish(cookie.categories),
      }

      await CookieConsent.run(config)

      if (cancelled) return

      // The ESM build does not attach itself to `window` (only the UMD one
      // does). `consent.ts` reads the plugin from here; until this line lands
      // it falls back to parsing `cc_cookie`.
      window.CookieConsent = CookieConsent

      // Consent that was already on file when `run()` started does not go
      // through `onChange`; `onConsent` covers it, but publishing once more
      // here costs nothing and closes the gap for a subscriber that mounted
      // during the import.
      publish(CookieConsent.getUserPreferences().acceptedCategories)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Legacy contract: anything can open the dialog by dispatching this event,
  // without importing the plugin (the footer button predates this component).
  useEffect(() => {
    const open = () => openCookiePreferences()

    window.addEventListener(COOKIE_PREFERENCES_EVENT, open)

    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, open)
  }, [])

  return null
}

export default CookieConsentBanner
