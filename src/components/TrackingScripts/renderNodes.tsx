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
 */
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

        const scriptProps = node.attrs as unknown as JSX.IntrinsicElements['script']

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
