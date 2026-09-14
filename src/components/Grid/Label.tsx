import clsx from 'clsx'
import React from 'react'

import { Price } from '@/components/Price'

type Props = {
  amount: number
  position?: 'bottom' | 'center'
  title: string
}

/**
 * Tile caption. Title rides a frosted white chip, price a solid accent chip —
 * both `rounded-default`, never pills (design.md: no `rounded-full` on anything
 * carrying a text label).
 */
export const Label: React.FC<Props> = ({ amount, position = 'bottom', title }) => {
  return (
    <div
      className={clsx('@container/label absolute bottom-0 left-0 flex w-full px-3 pb-3', {
        '': position === 'center',
      })}
    >
      <div className="flex grow items-end justify-between gap-2 text-sm">
        <h3 className="line-clamp-2 rounded-default border border-gray-100 bg-white/85 p-2 px-3 font-sans text-[12px] font-medium leading-tight tracking-tight text-black backdrop-blur-md">
          {title}
        </h3>

        <Price
          amount={amount}
          as="span"
          className="flex-none rounded-default bg-accent p-2 px-3 font-tech text-[12px] font-bold leading-none text-white"
          currencyCodeClassName="hidden @[275px]/label:inline"
        />
      </div>
    </div>
  )
}
