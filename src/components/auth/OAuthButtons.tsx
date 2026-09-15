import React from 'react'

import type { OAuthProvider } from '@/auth/oauth/providers'

/**
 * „Pokračovať cez Google / Facebook" + the „alebo" divider.
 *
 * Purely presentational and server-rendered: each button is a plain `<a>` to a
 * route handler, so there is no client JavaScript and no client-side router
 * involved (a `next/link` would try to prefetch an API route).
 *
 * Which buttons exist is decided by the *server* — the page checks whether the
 * credentials are present and passes booleans. Nothing about the credentials
 * themselves crosses into the rendered HTML.
 */

type Props = {
  /** Which providers the server considers configured. */
  providers: Record<OAuthProvider, boolean>
  /** Same-origin path to land on after a successful login. Re-validated server-side. */
  redirect?: null | string
}

const buttonClassName =
  'inline-flex h-12 w-full items-center justify-center gap-3 rounded-default border border-gray-200 bg-white text-[13px] font-bold uppercase tracking-widest text-black transition-colors duration-300 hover:border-brand hover:text-brand'

const glyphClassName = 'size-4 shrink-0'

/** Monochrome brand glyphs (currentColor) so they inherit the hover state. */
const glyphs: Record<OAuthProvider, React.ReactNode> = {
  facebook: (
    <svg aria-hidden="true" className={glyphClassName} fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  ),
  google: (
    <svg aria-hidden="true" className={glyphClassName} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24Z" />
    </svg>
  ),
}

const labels: Record<OAuthProvider, string> = {
  facebook: 'Pokračovať cez Facebook',
  google: 'Pokračovať cez Google',
}

export const OAuthButtons: React.FC<Props> = ({ providers, redirect }) => {
  const enabled = (['google', 'facebook'] as const).filter((provider) => providers[provider])

  // No credentials configured anywhere -> the section does not exist at all,
  // and the e-mail form is the whole page exactly as before.
  if (enabled.length === 0) return null

  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''

  return (
    <div className="mb-8">
      <div className="flex flex-col gap-3">
        {enabled.map((provider) => (
          <a className={buttonClassName} href={`/api/oauth/${provider}${query}`} key={provider}>
            {glyphs[provider]}
            {labels[provider]}
          </a>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-gray-100" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">alebo</span>
        <span aria-hidden className="h-px flex-1 bg-gray-100" />
      </div>
    </div>
  )
}
