import type { Metadata } from 'next'

import { AccountCard } from '@/components/account/AccountCard'
import { getContact } from '@/utilities/getContact'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { CalendarClock, Mail, MapPin, Phone, PackageCheck, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ order?: string }>
}

/** Steps are identical for both cases — only the reason differs. */
const steps = [
  {
    text: 'Napíšte nám e-mail s číslom objednávky, názvom tovaru a stručným popisom dôvodu (vrátenie alebo reklamácia). Priložte prosím aj fotografie, ak ide o poškodený tovar.',
    title: 'Ozvite sa nám',
  },
  {
    text: 'Do dvoch pracovných dní vám odpovieme a pošleme pokyny, kam a ako tovar zaslať. Nič neposielajte na dobierku — takúto zásielku nemôžeme prevziať.',
    title: 'Počkajte na pokyny',
  },
  {
    text: 'Tovar zabaľte tak, aby sa pri preprave nepoškodil, a odošlite na adresu z pokynov. Priložte kópiu faktúry alebo číslo objednávky.',
    title: 'Odošlite tovar',
  },
  {
    text: 'Po prijatí a kontrole tovaru vám peniaze vrátime najneskôr do 14 dní, a to rovnakým spôsobom, akým ste platili. Pri reklamácii vás budeme informovať o jej vybavení.',
    title: 'Vyriešime to',
  },
]

export default async function ReturnsPage({ searchParams }: PageProps) {
  const { order } = await searchParams
  const contact = await getContact()

  const orderNumber = order?.trim()
  const subject = `Reklamácia / vrátenie — objednávka č. ${orderNumber ? orderNumber : '…'}`
  const mailtoHref = `mailto:${contact.email.info}?subject=${encodeURIComponent(subject)}`

  return (
    <>
      <div>
        <p className="eyebrow">Môj účet</p>
        <h1 className="section-h2 mt-3 text-[28px] sm:text-[38px]">
          Reklamácia a vrátenie tovaru
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-gray-600">
          Každý kúsok u nás vzniká ručne. Ak vám niečo nesadlo alebo dorazilo poškodené, dáme to do
          poriadku — stačí sa nám ozvať.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AccountCard
          description="Tovar kúpený cez e-shop môžete vrátiť do 14 dní od prevzatia, aj bez udania dôvodu. Tovar by mal byť nepoužitý, nepoškodený a pokiaľ možno v pôvodnom obale."
          icon={CalendarClock}
          title="Vrátenie do 14 dní"
        />

        <AccountCard
          description="Na tovar sa vzťahuje zákonná záruka 24 mesiacov. Reklamovať môžete vadu, ktorá sa prejavila počas záručnej doby — nie bežné opotrebenie ani poškodenie nesprávnym používaním."
          icon={ShieldCheck}
          title="Reklamácia (záruka 24 mesiacov)"
        />
      </div>

      <AccountCard
        description="Štyri kroky, nič viac."
        icon={PackageCheck}
        title="Ako postupovať"
      >
        <ol className="flex flex-col gap-5">
          {steps.map((step, index) => (
            <li className="flex gap-4" key={step.title}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-sans text-sm font-bold text-black">{step.title}</p>
                <p className="mt-1 font-sans text-[13px] leading-relaxed text-gray-600">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col gap-3 rounded-default bg-brand-50 p-5">
          <p className="font-sans text-[13px] leading-relaxed text-gray-700">
            {orderNumber
              ? `Píšete kvôli objednávke č. ${orderNumber} — predmet e-mailu máme pripravený.`
              : 'Predmet e-mailu vyplníme za vás, číslo objednávky doplňte prosím do správy.'}
          </p>
          <a
            className="inline-flex w-full items-center justify-center gap-2 rounded-default bg-brand px-6 py-3.5 font-sans text-[12px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-dark sm:w-auto sm:self-start"
            href={mailtoHref}
          >
            <Mail className="size-4" />
            Napísať e-mail
          </a>
        </div>
      </AccountCard>

      <AccountCard
        description="Radi poradíme aj telefonicky, v pracovných dňoch."
        icon={Mail}
        title="Kontakt"
      >
        <ul className="flex flex-col gap-3">
          <li className="flex items-start gap-3 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3.5">
            <Mail className="mt-0.5 size-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
                E-mail
              </p>
              <a
                className="break-all font-sans text-sm font-bold text-black transition-colors hover:text-brand"
                href={contact.email.href}
              >
                {contact.email.info}
              </a>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3.5">
            <Phone className="mt-0.5 size-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Telefón
              </p>
              <a
                className="font-sans text-sm font-bold text-black transition-colors hover:text-brand"
                href={contact.phone.href}
              >
                {contact.phone.display}
              </a>
              {contact.openingHours && (
                <p className="mt-1 font-sans text-xs text-gray-500">{contact.openingHours}</p>
              )}
            </div>
          </li>

          {contact.address && (
            <li className="flex items-start gap-3 rounded-default border border-gray-100 bg-gray-50/60 px-4 py-3.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Adresa
                </p>
                <p className="font-sans text-sm font-bold text-black">{contact.address}</p>
              </div>
            </li>
          )}
        </ul>

        <p className="mt-5 font-sans text-xs leading-relaxed text-gray-500">
          Číslo objednávky nájdete v e-maile s potvrdením objednávky alebo v sekcii{' '}
          <Link className="font-bold text-black underline hover:text-brand" href="/orders">
            Objednávky
          </Link>
          .
        </p>
      </AccountCard>
    </>
  )
}

export const metadata: Metadata = {
  description:
    'Ako vrátiť tovar do 14 dní a ako postupovať pri reklamácii v ZAPLETANE e-shope.',
  openGraph: mergeOpenGraph({
    title: 'Reklamácia a vrátenie tovaru',
    url: '/account/returns',
  }),
  title: 'Reklamácia a vrátenie tovaru',
}
