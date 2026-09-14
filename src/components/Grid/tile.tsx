import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { Label } from '@/components/Grid/Label'
import clsx from 'clsx'
import React from 'react'

type Props = {
  active?: boolean
  isInteractive?: boolean
  label?: {
    amount: number
    position?: 'bottom' | 'center'
    title: string
  }
  media: MediaType
}

/**
 * Shared photo tile (carousel / three-up grid). Same stage treatment as the
 * product card: cream backdrop, `object-contain` + `mix-blend-multiply` so white
 * studio backgrounds melt in, hairline border that goes espresso on hover,
 * `rounded-default` corners.
 */
export const GridTileImage: React.FC<Props> = ({
  active,
  isInteractive = true,
  label,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'group flex h-full w-full items-center justify-center overflow-hidden rounded-default border bg-gray-50 transition-colors duration-200',
        {
          'border-black': active,
          'border-gray-100 hover:border-black': !active,
          relative: label,
        },
      )}
    >
      {props.media ? (
        <Media
          className={clsx('relative h-full w-full')}
          height={80}
          imgClassName={clsx('h-full w-full object-contain p-4 mix-blend-multiply', {
            'transition-transform duration-500 ease-out group-hover:scale-105': isInteractive,
          })}
          resource={props.media}
          width={80}
        />
      ) : null}
      {label ? <Label amount={label.amount} position={label.position} title={label.title} /> : null}
    </div>
  )
}
