import Script from 'next/script'
import React from 'react'

import { defaultTheme, themeLocalStorageKey } from '../shared'

/**
 * Z17 pin: the STOREFRONT is light-only by design (see the matching comment
 * on `getImplicitPreference` in `../shared.ts`) — this script can't import
 * that module (it has to run inline, before hydration, to avoid a
 * light->dark flash), so the `prefers-color-scheme` read that used to live
 * here is removed by hand, in step with `shared.ts`. Only a previously
 * stored, explicit `light`/`dark` preference can still override
 * `defaultTheme`; a device's dark system preference alone no longer can.
 */
export const InitTheme: React.FC = () => {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    function themeIsValid(theme) {
      return theme === 'light' || theme === 'dark'
    }

    var themeToSet = '${defaultTheme}'
    var preference = window.localStorage.getItem('${themeLocalStorageKey}')

    if (themeIsValid(preference)) {
      themeToSet = preference
    }

    document.documentElement.setAttribute('data-theme', themeToSet)
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  )
}
