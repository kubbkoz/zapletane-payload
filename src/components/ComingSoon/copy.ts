/**
 * Pre-launch page copy — verbatim from the Nuxt app's
 * `server/utils/coming-soon-page.ts` (`COMING_SOON_COPY`).
 *
 * Plain TS on purpose (no React, no `next/*`): the `site-settings` global
 * imports it for its field defaults, and a Payload config must stay importable
 * from the CLI (`payload migrate:create`, `generate:types`).
 *
 * Slovak, do not translate or paraphrase — see DESIGN-SPEC.md §4.2.
 */
export interface ComingSoonCopy {
  eyebrow: string
  title: string
  body: string
  note: string
}

export const COMING_SOON_COPY: ComingSoonCopy = {
  eyebrow: 'Čoskoro spúšťame',
  title: 'Pripravujeme\npre vás obchod',
  body:
    'Ručne pletené dekorácie, deky a hračky aj prútené dekorácie — poctivá ručná ' +
    'výroba, ktorá zahreje a poteší. Práve dokončujeme posledné kúsky a už čoskoro sme online.',
  note: 'Medzitým nám pokojne napíšte alebo zavolajte — radi poradíme.',
}

/** Stable, never build-hashed — the page has to render even if the app is broken. */
export const COMING_SOON_HERO = '/assets/images/hero/hero-kolekcia.webp'
