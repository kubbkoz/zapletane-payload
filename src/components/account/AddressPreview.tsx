import type { Address } from '@/payload-types'
import type { AddressKind } from '@/components/addresses/slots'

import {
  addressPersonLine,
  addressSlotMeta,
  addressSummaryLine,
  countryLabel,
} from '@/components/addresses/slots'
import { Check, Minus } from 'lucide-react'

type Props = {
  address?: Address
  kind: AddressKind
}

/** Compact, read-only slot preview for the account hub. */
export const AddressPreview: React.FC<Props> = ({ address, kind }) => (
  <div className="flex items-start gap-3 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3.5">
    <span
      className={
        address
          ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-light text-success'
          : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400'
      }
    >
      {address ? <Check className="size-3" /> : <Minus className="size-3" />}
    </span>

    <div className="min-w-0">
      <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {addressSlotMeta[kind].label}
      </p>

      {address ? (
        <p className="mt-1 font-sans text-[13px] leading-snug text-gray-700">
          <span className="font-bold text-black">{addressPersonLine(address)}</span>
          <br />
          {addressSummaryLine(address)}
          {address.country && `, ${countryLabel(address.country)}`}
        </p>
      ) : (
        <p className="mt-1 font-sans text-[13px] text-gray-400">Nevyplnená</p>
      )}
    </div>
  </div>
)
