import type { JSX } from 'react'

import type { TrackingNode } from '@/lib/trackingScripts'

/**
 * Renders parsed marketing snippets as real DOM elements, in the order they
 * were pasted.
 *
 * The attributes come from `site-settings.marketing`, which only an admin can
 * write (the global's `update` access is `adminOnly`). That is the trust
 * boundary: everything below renders unescaped, exactly like a hand-written tag
 * in the HTML file would.
 *
 * CONSENT GATE
 * Every `<script>` — inline or `src`, head or body-start — is rendered inert:
 * `type="text/plain"` plus `data-category="analytics"`. The browser parses it
 * and refuses to execute it; `vanilla-cookieconsent` (see
 * `src/components/CookieConsent/`) collects exactly these tags, and once the
 * analytics category is consented it strips the `type`, clones the tag and
 * replaces the inert one — at which point it runs, with no page reload.
 * Withdrawing consent leaves the already-executed tag alone (nothing can
 * un-run a script) but blocks it on every later page load and clears the
 * category's cookies.
 *
 * `<meta>` and `<link>` are *not* gated: a `google-site-verification` meta or
 * a `dns-prefetch` hint stores nothing on the device and tracks nobody.
 */
const CONSENT_CATEGORY = 'analytics'

type ScriptAttrs = Record<string, string | true>

/**
 * Turn a parsed script's attributes into an inert, consent-gated set.
 *
 * A snippet that carried its own `type` (`module`, `text/javascript`, …) has
 * it moved to `data-type`, which is the plugin's documented way of restoring
 * the original type on activation — dropping it would turn an ES module into a
 * classic script.
 */
const gateScript = (attrs: ScriptAttrs): ScriptAttrs => {
  const { type: originalType, ...rest } = attrs

  return {
    ...rest,
    ...(typeof originalType === 'string' && originalType ? { 'data-type': originalType } : {}),
    'data-category': CONSENT_CATEGORY,
    type: 'text/plain',
  }
}

export const TrackingNodes = ({ nodes }: { nodes: TrackingNode[] }) => {
  if (nodes.length === 0) return null

  return (
    <>
      {nodes.map((node, index) => {
        const key = `tracking-${index}`

        if (node.type === 'noscript') {
          return <noscript dangerouslySetInnerHTML={{ __html: node.html }} key={key} />
        }

        if (node.type === 'meta') {
          return <meta {...(node.attrs as unknown as JSX.IntrinsicElements['meta'])} key={key} />
        }

        if (node.type === 'link') {
          return <link {...(node.attrs as unknown as JSX.IntrinsicElements['link'])} key={key} />
        }

        const scriptProps = gateScript(node.attrs) as unknown as JSX.IntrinsicElements['script']

        if (node.content) {
          return (
            <script
              {...scriptProps}
              dangerouslySetInnerHTML={{ __html: node.content }}
              key={key}
            />
          )
        }

        return <script {...scriptProps} key={key} />
      })}
    </>
  )
}
