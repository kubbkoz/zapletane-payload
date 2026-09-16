import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { DefaultNodeTypes, SerializedBlockNode } from '@payloadcms/richtext-lexical'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  JSXConvertersFunction,
  RichText as RichTextWithoutBlocks,
} from '@payloadcms/richtext-lexical/react'

import { CodeBlock, CodeBlockProps } from '@/blocks/Code/Component'

import type {
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  MediaBlock as MediaBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { cn } from '@/utilities/cn'

type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<CTABlockProps | MediaBlockProps | BannerBlockProps | CodeBlockProps>

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
    mediaBlock: ({ node }) => (
      <MediaBlock
        className="col-start-1 col-span-3"
        imgClassName="m-0"
        {...node.fields}
        captionClassName="mx-auto max-w-3xl"
        enableGutter={false}
        disableInnerContainer={true}
      />
    ),
    code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
    cta: ({ node }) => <CallToActionBlock {...node.fields} />,
  },
})

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  /**
   * Z17: small brown heart/knot mark (the site's own logo mark, see
   * src/components/Logo/Logo.tsx) to the left of every h2/h3 this renders.
   * Pure CSS (`.richtext-heading-mark` in globals.css) — opt-in per call
   * site so it stays scoped to article-style bodies (blog article content +
   * PDP description today) and never touches Banner/Content/other blocks
   * that also go through this component.
   */
  enableHeadingMark?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export const RichText: React.FC<Props> = (props) => {
  const {
    className,
    enableProse = true,
    enableGutter = true,
    enableHeadingMark = false,
    ...rest
  } = props
  return (
    <RichTextWithoutBlocks
      converters={jsxConverters}
      className={cn(
        {
          'container ': enableGutter,
          'max-w-none': !enableGutter,
          // Z17: the storefront is light-only (design.md) — colors are
          // fixed utility classes, not `dark:`-scoped, so this reads
          // dark-on-cream unconditionally, even if the `data-theme` pin in
          // src/providers/Theme ever gets bypassed. `dark:prose-invert`
          // (removed) was the actual cause of white headings / pale-gray
          // body text on a dark system preference — it hardcodes
          // light-on-dark colors meant for a dark page background, which
          // this storefront never has.
          'mx-auto prose md:prose-md prose-headings:text-black prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-black ':
            enableProse,
          'richtext-heading-mark': enableHeadingMark,
        },
        className,
      )}
      {...rest}
    />
  )
}
