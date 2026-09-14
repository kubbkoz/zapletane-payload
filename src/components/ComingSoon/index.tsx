import React from 'react'

import { COMING_SOON_COPY, COMING_SOON_HERO, type ComingSoonCopy } from './copy'
import { CONTACT } from '@/lib/contact'

/**
 * Pre-launch page — a 1:1 port of the Nuxt app's `renderComingSoonPage()`
 * (`server/utils/coming-soon-page.ts`, transcribed in DESIGN-SPEC.md §4.2).
 *
 * Deliberately self-contained, exactly like the original: its own inline CSS,
 * its own @font-face rules pointing at stable (never build-hashed) `/fonts/*`
 * paths, the logo re-drawn as static SVG markup, no client JavaScript, no
 * commerce call. It renders the whole document, so the storefront chrome
 * (header, footer, providers, theme script) is never mounted behind it.
 *
 * Two small adaptations to living inside a Next.js root layout, both invisible
 * in the output:
 *   - `data-theme="light"` on <html>. `globals.css` ships `html { opacity: 0 }`
 *     (an unlayered rule) which only lifts once a theme attribute is present;
 *     the app's InitTheme script normally sets it, and it does not run here.
 *   - Every rule below is unlayered, so it wins over Tailwind's preflight and
 *     the app's own `@layer base` body rules regardless of stylesheet order.
 */

const STYLES = `
@font-face{font-family:Unbounded;font-style:normal;font-weight:200 900;font-display:swap;
  src:url(/fonts/unbounded-latin-ext-wght-normal.woff2) format("woff2");
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Unbounded;font-style:normal;font-weight:200 900;font-display:swap;
  src:url(/fonts/unbounded-latin-wght-normal.woff2) format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"DM Sans";font-style:normal;font-weight:400;font-display:swap;
  src:url(/fonts/dm-sans-latin-ext-400-normal.woff2) format("woff2");
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"DM Sans";font-style:normal;font-weight:400;font-display:swap;
  src:url(/fonts/dm-sans-latin-400-normal.woff2) format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

:root{
  --brand-100:#f2e9e5; --brand-200:#e4d2cb; --brand-400:#bc9a92;
  --brand-600:#8e6b64; --brand-700:#755650; --brand-800:#5a423d;
  --cream:#faf7f5; --ink:#241917;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;background:var(--cream);color:var(--ink);
  font-family:"DM Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  display:block}
h1{font-family:Unbounded,"DM Sans",sans-serif;font-weight:500;font-style:normal;
  letter-spacing:-.02em;margin:0}

.page{min-height:100dvh;display:flex;flex-direction:column;
  max-width:1180px;margin:0 auto;padding:28px 24px 40px}
@media(min-width:1024px){.page{padding:32px 40px 48px}}

.brand{display:flex;align-items:center;gap:.3em;
  font-family:Unbounded,"DM Sans",sans-serif;font-weight:600;font-size:1.4rem;
  letter-spacing:-.03em;line-height:1;color:var(--ink)}
.brand svg{width:1.5em;height:1.19em;flex:0 0 auto}
.dot{color:var(--brand-700)}

.grid{flex:1;display:grid;align-items:center;gap:40px;padding:48px 0}
@media(min-width:1024px){
  .grid{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:64px;padding:24px 0}
}

.eyebrow{margin:0;font-size:11px;font-weight:500;text-transform:uppercase;
  letter-spacing:.22em;color:var(--brand-800)}
h1{margin-top:24px;font-size:clamp(32px,6vw,46px);line-height:1.08;text-wrap:balance}
.lede{margin:28px 0 0;max-width:420px;font-size:15px;line-height:1.75;color:var(--brand-800)}
.note{margin:28px 0 0;max-width:420px;font-size:13.5px;line-height:1.7;color:var(--brand-600)}

.contact{margin:24px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:12px}
.contact a{display:inline-flex;align-items:center;height:48px;padding:0 24px;
  border-radius:2px;font-size:13px;font-weight:500;letter-spacing:.02em;text-decoration:none;
  transition:background-color .2s,border-color .2s,color .2s}
.contact .primary{background:var(--brand-700);color:#fff}
.contact .primary:hover{background:var(--brand-600)}
.contact .ghost{border:1px solid var(--brand-200);color:var(--ink)}
.contact .ghost:hover{border-color:var(--brand-400)}

.shot{position:relative;border-radius:2px;overflow:hidden;background:var(--brand-100);
  aspect-ratio:4/3}
@media(min-width:1024px){.shot{aspect-ratio:5/4}}
.shot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}

footer{border-top:1px solid var(--brand-200);padding-top:20px;
  font-size:12px;color:var(--brand-600);
  display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between}
footer a{color:inherit}
`

/** Shape of the `site-settings` global's `comingSoon` group (every field optional/nullable). */
type ComingSoonCopyInput = { [K in keyof ComingSoonCopy]?: null | string }

type Props = {
  copy?: ComingSoonCopyInput | null
  email?: null | string
  phone?: null | string
}

export function ComingSoonPage({ copy, email, phone }: Props) {
  const eyebrow = copy?.eyebrow?.trim() || COMING_SOON_COPY.eyebrow
  const title = copy?.title?.trim() || COMING_SOON_COPY.title
  const body = copy?.body?.trim() || COMING_SOON_COPY.body
  const note = copy?.note?.trim() || COMING_SOON_COPY.note

  const phoneDisplay = phone?.trim() || CONTACT.phone.display
  const phoneHref = `tel:${phoneDisplay.replace(/\s/g, '')}`
  const emailDisplay = email?.trim() || CONTACT.email.info
  const emailHref = `mailto:${emailDisplay}`

  const [titleFirst, titleSecond] = title.split('\n')

  return (
    <html data-theme="light" lang="sk">
      <head>
        <title>Zapletane — čoskoro sme online</title>
        <meta content={body} name="description" />
        {/* Pre-launch placeholder: keep it out of the index so it never
            outranks the real homepage once the storefront goes live. */}
        <meta content="noindex, follow" name="robots" />
        <meta content="website" property="og:type" />
        <meta content="Zapletane — čoskoro sme online" property="og:title" />
        <meta content={body} property="og:description" />
        <meta content={COMING_SOON_HERO} property="og:image" />
        <meta content="sk_SK" property="og:locale" />
        <meta content="#faf7f5" name="theme-color" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <link
          as="font"
          crossOrigin=""
          href="/fonts/unbounded-latin-ext-wght-normal.woff2"
          rel="preload"
          type="font/woff2"
        />
        <link as="image" href={COMING_SOON_HERO} rel="preload" />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <div className="page">
          <header>
            <div className="brand">
              <svg aria-label="Zapletane" fill="none" role="img" viewBox="0 0 136 108">
                <rect
                  height="40"
                  rx="20"
                  stroke="#bc9a92"
                  strokeWidth="15"
                  transform="translate(54,54) rotate(45)"
                  width="80"
                  x="-40"
                  y="-20"
                />
                <rect
                  height="40"
                  rx="20"
                  stroke="#8e6b64"
                  strokeWidth="15"
                  style={{ mixBlendMode: 'multiply' }}
                  transform="translate(82,54) rotate(-45)"
                  width="80"
                  x="-40"
                  y="-20"
                />
              </svg>
              <span>
                Zapletane<span className="dot">.</span>
              </span>
            </div>
          </header>

          <main className="grid">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>
                {titleFirst}
                {titleSecond ? (
                  <>
                    <br />
                    {titleSecond}
                  </>
                ) : null}
              </h1>
              <p className="lede">{body}</p>
              <p className="note">{note}</p>
              <ul className="contact">
                <li>
                  <a className="primary" href={phoneHref}>
                    {phoneDisplay}
                  </a>
                </li>
                <li>
                  <a className="ghost" href={emailHref}>
                    {emailDisplay}
                  </a>
                </li>
              </ul>
            </div>

            <div className="shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Ručne pletené a prútené kúsky pre domov"
                height={960}
                src={COMING_SOON_HERO}
                width={1200}
              />
            </div>
          </main>

          <footer>
            <span>&copy; {new Date().getFullYear()} Zapletane</span>
            <span>
              <a href={emailHref}>{emailDisplay}</a>
            </span>
          </footer>
        </div>
      </body>
    </html>
  )
}
