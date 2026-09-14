import Link from 'next/link'
import React from 'react'
import { CompassIcon } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="bg-brand-50 py-24 md:py-32">
      <div className="container-page">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand">
            <CompassIcon className="size-7" strokeWidth={1.5} />
          </span>

          <p className="eyebrow mt-6">Chyba 404</p>
          <h1 className="section-h2 mt-3 text-[32px] sm:text-[38px]">
            Stránka sa <span className="text-brand">nenašla</span>
          </h1>
          <div className="section-decorator mt-5" />

          <p className="mt-6 text-sm leading-relaxed text-gray-600">
            Túto stránku sme nenašli. Možno bola presunutá alebo už neexistuje.
          </p>

          <Link href="/" className="btn-primary group mt-8">
            Späť na hlavnú stránku
          </Link>
        </div>
      </div>
    </div>
  )
}
