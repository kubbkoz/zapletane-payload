import Link from 'next/link'
import React from 'react'

type Props = {
  /** Adresa bez parametrov, napr. `/blog` alebo `/kategoria/deky`. */
  basePath: string
  currentPage: number
  /** Ostatné parametre adresy, ktoré majú prežiť preklik. */
  searchParams?: Record<string, string | string[] | undefined>
  totalPages: number
}

/**
 * Stránkovanie pre výpisy, ktoré nežijú na `/shop`.
 *
 * Vzhľad aj správanie sú zhodné s `components/shop-filters/Pagination` (tá má
 * `/shop` napevno, lebo ju k ničomu inému netreba) — jediný rozdiel je, že
 * základnú cestu dostane zvonku, takže návštevník ostáva na `/blog`, resp. na
 * vstupnej stránke kategórie, a nevypadne z kanonickej adresy.
 *
 * Obyčajné serverom vykreslené odkazy, nie klientsky „načítať ďalšie": funguje
 * to bez JavaScriptu, tlačidlo Späť robí presne to, čo má, a vyhľadávač
 * jednotlivé strany naozaj vidí.
 */
const hrefForPage = (
  basePath: string,
  searchParams: Props['searchParams'],
  page: number,
): string => {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === 'page' || value === undefined) continue

    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry)
  }

  // Prvá strana je predvolená — `?page=1` by adresu len zašpinil.
  if (page > 1) params.set('page', String(page))

  const query = params.toString()

  return `${basePath}${query ? `?${query}` : ''}`
}

export const Pager: React.FC<Props> = ({ basePath, currentPage, searchParams, totalPages }) => {
  if (totalPages <= 1) return null

  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <nav aria-label="Stránkovanie" className="mt-12 flex items-center justify-center gap-4">
      {hasPrev ? (
        <Link
          className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-[11px]"
          href={hrefForPage(basePath, searchParams, currentPage - 1)}
        >
          Predchádzajúce
        </Link>
      ) : null}

      <span className="font-sans text-[12px] text-gray-500">
        Strana {currentPage} z {totalPages}
      </span>

      {hasNext ? (
        <Link
          className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-[11px]"
          href={hrefForPage(basePath, searchParams, currentPage + 1)}
        >
          Načítať ďalšie
        </Link>
      ) : null}
    </nav>
  )
}

export default Pager
