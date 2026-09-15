import type { Address } from '@/payload-types'

/**
 * The account section manages exactly two logical address slots per customer.
 * The slot is stored on the `kind` select field added to the addresses
 * collection through the ecommerce plugin override (src/plugins/index.ts).
 *
 * Kept free of JSX so both server components (the account hub, the addresses
 * page) and client components (the slot card) can share the same labels.
 */
export type AddressKind = NonNullable<Address['kind']>

export const addressKinds: AddressKind[] = ['billing', 'shipping']

export const addressSlotMeta: Record<
  AddressKind,
  { accusative: string; description: string; emptyHint: string; label: string }
> = {
  billing: {
    // Slovak needs the accusative after „použiť ako…", so the label cannot
    // simply be lower-cased into a sentence.
    accusative: 'fakturačnú adresu',
    description: 'Adresa, na ktorú vystavíme faktúru.',
    emptyHint: 'Zatiaľ nemáte uloženú fakturačnú adresu.',
    label: 'Fakturačná adresa',
  },
  shipping: {
    accusative: 'dodaciu adresu',
    description: 'Adresa, na ktorú doručíme objednávku.',
    emptyHint: 'Zatiaľ nemáte uloženú dodaciu adresu.',
    label: 'Dodacia adresa',
  },
}

/**
 * Exactly one address per slot: the first match wins, so a database that
 * somehow holds two „billing" rows still renders a single, editable slot
 * instead of duplicating the card.
 */
export const addressForKind = (
  addresses: Address[] | null | undefined,
  kind: AddressKind,
): Address | undefined => addresses?.find((address) => address.kind === kind)

/** Addresses saved before the slots existed — surfaced, never silently hidden. */
export const unassignedAddresses = (addresses: Address[] | null | undefined): Address[] =>
  (addresses ?? []).filter((address) => address.kind !== 'billing' && address.kind !== 'shipping')

/**
 * Slovak country names for the codes a ZAPLETANE customer realistically picks.
 * Anything else falls back to the raw ISO code — the plugin's own country list
 * is English-labelled, so printing the label would break the Slovak UI.
 */
export const countryLabels: Record<string, string> = {
  AT: 'Rakúsko',
  CZ: 'Česko',
  DE: 'Nemecko',
  HU: 'Maďarsko',
  PL: 'Poľsko',
  SK: 'Slovensko',
}

export const countryLabel = (code?: null | string): string =>
  code ? (countryLabels[code] ?? code) : ''

/** „83101" → „831 01" — Slovak PSČ is written with a space; anything else is left alone. */
export const formatPostalCode = (postalCode?: null | string): string => {
  const trimmed = (postalCode ?? '').trim()

  return /^\d{5}$/.test(trimmed) ? `${trimmed.slice(0, 3)} ${trimmed.slice(3)}` : trimmed
}

/** Single-line summary for compact previews (account hub). */
export const addressSummaryLine = (address: Address): string =>
  [address.addressLine1, formatPostalCode(address.postalCode), address.city]
    .filter(Boolean)
    .join(', ')

export const addressPersonLine = (address: Address): string =>
  [address.firstName, address.lastName].filter(Boolean).join(' ')
