'use client'

import type { HeroPerk, HeroSlide } from '@/lib/homeDefaults'

import { ArrowRight, Play, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { ContentIcon } from '@/components/ContentIcon'
import { HERO_PERKS, HERO_SLIDES } from '@/lib/homeDefaults'
import { cn } from '@/utilities/cn'

type Props = {
  perks?: HeroPerk[]
  slides?: HeroSlide[]
}

/**
 * Pozadie jednej snímky — fotka, alebo video, keď ho snímka má (Z9).
 *
 * Obmedzenie pohybu (`prefers-reduced-motion: reduce`) rieši dvojicou:
 *
 *   1. CSS (`motion-reduce:hidden` / `motion-reduce:block`) prehodí video za
 *      fotku okamžite, už pri prvom vykreslení — bez bliknutia, ktoré by
 *      priniesla výmena až po hydratácii, a funguje aj bez JavaScriptu.
 *   2. Efekt nižšie video naozaj zastaví a zoberie mu `autoplay`, aby sa
 *      skryté video ani nesťahovalo. Ten istý efekt pauzuje aj snímky, ktoré
 *      práve nie sú na rade — v slideri bežia inak všetky naraz.
 *
 * Fotka zostáva pod videom ako `poster` aj ako záloha pre prehliadač, ktorý
 * formát neprehrá; `<video>` samo o sebe nepotrebuje JavaScript (autoplay,
 * muted, loop, playsInline stačia aj na iOS).
 */
const SlideMedia: React.FC<{ active: boolean; priority: boolean; slide: HeroSlide }> = ({
  active,
  priority,
  slide,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const poster = slide.videoPoster || slide.image

  React.useEffect(() => {
    const video = videoRef.current

    if (!video) return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')

    const sync = () => {
      if (query.matches || !active) {
        video.removeAttribute('autoplay')
        video.pause()
        return
      }

      void video.play().catch(() => undefined)
    }

    sync()
    query.addEventListener('change', sync)

    return () => query.removeEventListener('change', sync)
  }, [active])

  if (!slide.video) {
    return (
      <Image
        alt={slide.title}
        className="object-cover"
        fill
        priority={priority}
        sizes="(max-width: 1024px) 100vw, 55vw"
        src={slide.image}
      />
    )
  }

  return (
    <React.Fragment>
      <video
        aria-hidden="true"
        autoPlay
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        loop
        muted
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
      >
        <source src={slide.video} type={slide.videoMimeType || 'video/mp4'} />
      </video>
      <Image
        alt={slide.title}
        className="hidden object-cover motion-reduce:block"
        fill
        sizes="(max-width: 1024px) 100vw, 55vw"
        src={poster}
      />
    </React.Fragment>
  )
}

/**
 * Homepage hero — DESIGN-SPEC §3.1.
 *
 * `bg-brand-50` band, `container-editorial`, two columns on lg
 * (`minmax(0,1fr) minmax(0,1.15fr)`, text left / photo right, min-height
 * `calc(100dvh - var(--header-height))` from 1600px up). Left: eyebrow → the
 * one H1 in the app that keeps the Unbounded display face (the documented
 * "homepage hero exception") → lede → `btn-primary` + the circular play link →
 * the three brand perks. Right: full-bleed `rounded-sm` photo with the
 * shoppable hotspot layer and the pill dots on a blurred ink chip.
 *
 * Crossfades are opacity-only (compositor-safe) and honour reduced motion; there
 * is no bounce/elastic easing anywhere (design.md §9).
 *
 * Z11 — small-desktop (1024–1599.98px) viewport fill: the owner wants the
 * hero to end exactly at the fold on a 13–14" laptop, i.e.
 * `header height + hero height ≈ 100dvh`. Below 1600px the row's min-height
 * switches from the static `--header-height` reference token to
 * `--navbar-height-full` (the ResizeObserver's stable, pre-scroll
 * measurement — NOT `--navbar-height-current`, which shrinks on scroll and
 * would make the hero jump), via the `small-desktop`/`large-desktop`
 * custom-variant split in globals.css. Inside that same window the heading
 * drops its `lg:` 50px step (so it falls through to the existing `sm:` 44px
 * step — one size down, no new class needed), the lede shrinks one notch, and
 * the perk row's top margin tightens — all `small-desktop:`-scoped, so
 * <1024 and ≥1600 render byte-identical classes to before.
 */
export const HomeHero: React.FC<Props> = ({ perks = HERO_PERKS, slides = HERO_SLIDES }) => {
  const [current, setCurrent] = React.useState(0)
  const [activeHotspot, setActiveHotspot] = React.useState<string | null>(null)

  const slide = slides[current]

  React.useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => {
      setActiveHotspot((hotspot) => {
        if (!hotspot) setCurrent((index) => (index + 1) % slides.length)
        return hotspot
      })
    }, 6000)
    return () => clearInterval(timer)
  }, [slides.length])

  if (!slide) return null

  return (
    <section className="relative w-full overflow-hidden bg-brand-50">
      <div className="container-editorial">
        <div className="relative grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16 lg:py-6 small-desktop:min-h-[calc(100dvh-var(--navbar-height-full,131px))] large-desktop:min-h-[calc(100dvh-var(--header-height))]">
          {/* LEFT — text column */}
          <div className="relative z-20 order-2 max-w-[500px] lg:order-1">
            {slide.badge && <p className="eyebrow">{slide.badge}</p>}

            <h1 className="mt-6 break-words font-display text-[36px] font-medium leading-[1.06] tracking-tight text-black sm:text-[44px] large-desktop:text-[50px]">
              {slide.title}
            </h1>

            <p className="mt-7 max-w-[420px] font-sans text-[15px] leading-[1.75] text-gray-700 small-desktop:text-[14px] small-desktop:leading-[1.65]">
              {slide.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link className="btn-primary group" href={slide.ctaLink || '/shop'}>
                {slide.cta}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {slide.secondaryCta && (
                <Link
                  className="group inline-flex items-center gap-3 font-sans text-[13px] font-medium tracking-wide text-black transition-colors hover:text-brand"
                  href={slide.secondaryCtaLink || '#'}
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-brand-300 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                    <Play aria-hidden="true" className="ml-0.5 size-3.5 fill-current" />
                  </span>
                  <span className="underline decoration-brand-300 decoration-1 underline-offset-4">
                    {slide.secondaryCta}
                  </span>
                </Link>
              )}
            </div>

            <ul className="mt-14 flex flex-wrap gap-9 small-desktop:mt-8">
              {perks.map((perk) => (
                <li className="flex w-[92px] flex-col items-center text-center" key={perk.label}>
                  <ContentIcon className="size-8 text-brand" name={perk.icon} strokeWidth={1.4} />
                  <span className="mt-3 text-[12px] leading-snug text-gray-700">{perk.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — dominant hero photo. `small-desktop:min-h-[440px]` (was
              `lg:min-h-[560px]`) is the priority-2 shrink lever; the paired
              `max-h-[...]` mirrors the row's own content budget (viewport
              minus header minus the row's vertical padding) as a safety cap,
              so the photo can never be what pushes the hero past the fold —
              measured to hold even at the shortest tested small-desktop
              height (1280×720: 440px column still fits inside a 541px
              budget). */}
          <div className="relative order-1 min-h-[320px] sm:min-h-[420px] lg:order-2 small-desktop:min-h-[440px] small-desktop:max-h-[calc(100dvh-var(--navbar-height-full,131px)-48px)] large-desktop:min-h-[560px]">
            {slides.map((item, index) => (
              <div
                aria-hidden={index !== current}
                className={cn(
                  'absolute inset-0 overflow-hidden rounded-sm transition-opacity duration-700 ease-out motion-reduce:transition-none',
                  index === current ? 'opacity-100' : 'opacity-0',
                )}
                key={item.id}
              >
                <SlideMedia active={index === current} priority={index === 0} slide={item} />
              </div>
            ))}

            {/* Shoppable hotspots — desktop only, rendered over the photo */}
            {slide.hotspots.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
                {slide.hotspots.map((spot) => (
                  <div
                    className="pointer-events-auto absolute"
                    key={spot.id}
                    onMouseEnter={() => setActiveHotspot(spot.id)}
                    onMouseLeave={() => setActiveHotspot(null)}
                    style={{ top: `${spot.y}%`, left: `${spot.x}%` }}
                  >
                    <button
                      aria-expanded={activeHotspot === spot.id}
                      aria-label={`Zobraziť detail produktu ${spot.label}`.trim()}
                      className={cn(
                        'pointer-events-auto relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                        activeHotspot === spot.id
                          ? 'scale-110 bg-brand'
                          : 'bg-white/70 backdrop-blur-sm hover:bg-brand/80',
                      )}
                      type="button"
                    >
                      <span className="absolute inset-0 animate-pulse-slow rounded-full border-2 border-white" />
                      <Plus aria-hidden="true" className="h-4 w-4 text-white" />
                    </button>

                    <div
                      className={cn(
                        'pointer-events-auto absolute left-full top-1/2 z-[100] ml-4 flex w-96 origin-left -translate-y-1/2 gap-4 rounded-default bg-black/90 p-4 shadow-tooltip backdrop-blur-md transition-all duration-300',
                        activeHotspot === spot.id
                          ? 'visible scale-100 opacity-100'
                          : 'invisible scale-95 opacity-0',
                      )}
                    >
                      {spot.image && (
                        <div className="h-24 w-24 flex-shrink-0 rounded-sm bg-white p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={spot.label}
                            className="h-full w-full object-contain"
                            height={96}
                            loading="lazy"
                            src={spot.image}
                            width={96}
                          />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <h3 className="mb-1 line-clamp-2 font-tech text-lg font-bold uppercase leading-tight text-white">
                          {spot.label}
                        </h3>
                        <div className="mt-auto flex items-center justify-between border-t border-gray-700 pt-2">
                          <span className="font-tech text-lg font-black text-white underline decoration-brand decoration-2 underline-offset-4">
                            {spot.price}
                          </span>
                          {spot.link && (
                            <Link
                              className="rounded-sm bg-white/10 px-3 py-1 font-sans text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/20"
                              href={spot.link}
                            >
                              Viac info
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Slide dots — overlaid directly on the photo */}
            {slides.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-sm bg-black/25 px-3 py-2 backdrop-blur-sm">
                {slides.map((item, index) => (
                  <button
                    aria-current={current === index}
                    aria-label={`Prejsť na snímku ${index + 1}`}
                    className={cn(
                      'h-1.5 cursor-pointer rounded-sm transition-all duration-300',
                      current === index ? 'w-10 bg-white' : 'w-6 bg-white/45 hover:bg-white/75',
                    )}
                    key={item.id}
                    onClick={() => {
                      setCurrent(index)
                      setActiveHotspot(null)
                    }}
                    type="button"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
