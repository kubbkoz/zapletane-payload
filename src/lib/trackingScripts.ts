/**
 * Parser for the marketing snippets stored in `site-settings.marketing`
 * (Meta Pixel, Google Tag Manager, GA4, domain-verification tags…).
 *
 * Why parse at all, instead of injecting the stored string verbatim?
 *
 * Because there is no verbatim in the App Router. React cannot splice raw HTML
 * into `<head>` (`dangerouslySetInnerHTML` needs a host element to sit on, and a
 * wrapper `<div>` in `<head>` would be dropped by the HTML parser), and
 * `next/script` takes one script at a time — not a blob. Turning the blob into
 * real React elements is the reliable path: the elements land where the
 * component is mounted, in order, and browsers execute them exactly as they
 * would a hand-written tag.
 *
 * WHAT IS RECOGNISED (everything else in the field is ignored):
 *   - `<script src=…>` and `<script>…inline…</script>` (also self-closing)
 *   - `<noscript>…</noscript>` — the GTM iframe fallback
 *   - `<meta …>` — e.g. `google-site-verification`
 *   - `<link …>` — e.g. `dns-prefetch` / `preconnect` for a tag host
 *
 * KNOWN LIMITATIONS (documented for whoever pastes a snippet):
 *   - plain markup (divs, images, comments, tracking pixels written as `<img>`)
 *     is dropped — an `<img>` pixel belongs in a `<noscript>` block anyway;
 *   - `on*` inline event-handler attributes are stripped (React does not pass
 *     them through as HTML attributes); put the code in the script body;
 *   - a `</script>` sequence inside a JavaScript string ends the block early —
 *     which is equally true of a hand-written HTML file;
 *   - conditional comments and `<base>` are not supported.
 */

export type TrackingNode =
  | {
      attrs: Record<string, string | true>
      /** Inline JavaScript; empty for an external script. */
      content: string
      type: 'script'
    }
  | { attrs: Record<string, string | true>; type: 'link' }
  | { attrs: Record<string, string | true>; type: 'meta' }
  | { html: string; type: 'noscript' }

/** HTML attribute name -> React prop name, for the attributes that differ. */
const REACT_PROP_NAMES: Record<string, string> = {
  charset: 'charSet',
  class: 'className',
  crossorigin: 'crossOrigin',
  fetchpriority: 'fetchPriority',
  for: 'htmlFor',
  'http-equiv': 'httpEquiv',
  imagesizes: 'imageSizes',
  imagesrcset: 'imageSrcSet',
  nomodule: 'noModule',
  referrerpolicy: 'referrerPolicy',
}

/** Attributes whose mere presence means `true`. */
const BOOLEAN_ATTRS = new Set(['async', 'defer', 'nomodule'])

const ATTR_PATTERN =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const decodeEntities = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const parseAttributes = (raw: string): Record<string, string | true> => {
  const attrs: Record<string, string | true> = {}

  if (!raw) return attrs

  for (const match of raw.matchAll(ATTR_PATTERN)) {
    const name = match[1]!.toLowerCase()
    const rawValue = match[2] ?? match[3] ?? match[4]

    // Inline event handlers would not survive React's prop handling; the code
    // belongs in the script body instead.
    if (name.startsWith('on')) continue

    const propName = REACT_PROP_NAMES[name] ?? name

    if (BOOLEAN_ATTRS.has(name)) {
      attrs[propName] = true
      continue
    }

    attrs[propName] = rawValue === undefined ? true : decodeEntities(rawValue)
  }

  return attrs
}

/**
 * One pass over the blob, keeping document order. The alternation is ordered
 * so the paired tags (script/noscript) win over the void ones.
 */
const BLOCK_PATTERN = new RegExp(
  [
    '<script\\b([^>]*?)\\/>',
    '<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>',
    '<noscript\\b[^>]*>([\\s\\S]*?)<\\/noscript\\s*>',
    '<meta\\b([^>]*?)\\/?>',
    '<link\\b([^>]*?)\\/?>',
  ].join('|'),
  'gi',
)

export const parseTrackingScripts = (input?: null | string): TrackingNode[] => {
  const source = input?.trim()

  if (!source) return []

  const nodes: TrackingNode[] = []

  for (const match of source.matchAll(BLOCK_PATTERN)) {
    const [
      full,
      selfClosingScriptAttrs,
      scriptAttrs,
      scriptContent,
      noscriptContent,
      metaAttrs,
      linkAttrs,
    ] = match

    if (selfClosingScriptAttrs !== undefined) {
      nodes.push({ attrs: parseAttributes(selfClosingScriptAttrs), content: '', type: 'script' })
      continue
    }

    if (scriptAttrs !== undefined) {
      const attrs = parseAttributes(scriptAttrs)
      const content = (scriptContent ?? '').trim()

      // A script with neither a src nor a body would render an empty <script>
      // element for nothing.
      if (!attrs.src && !content) continue

      nodes.push({ attrs, content, type: 'script' })
      continue
    }

    if (noscriptContent !== undefined) {
      const html = noscriptContent.trim()

      if (html) nodes.push({ html, type: 'noscript' })
      continue
    }

    if (metaAttrs !== undefined) {
      const attrs = parseAttributes(metaAttrs)

      if (Object.keys(attrs).length) nodes.push({ attrs, type: 'meta' })
      continue
    }

    if (linkAttrs !== undefined) {
      const attrs = parseAttributes(linkAttrs)

      if (attrs.href) nodes.push({ attrs, type: 'link' })
      continue
    }

    // Unreachable — every alternative is handled above; keeps `full` used.
    void full
  }

  return nodes
}
