/**
 * Names shared by the two halves of the pre-launch gate: the bypass step in
 * `src/middleware.ts` (sets the cookie) and the gate decision in the (app) root
 * layout (reads it). Kept identical to the Nuxt original
 * (`server/middleware/coming-soon.ts`) so a browser already unlocked against
 * the old storefront stays unlocked here.
 */

/** httpOnly cookie that carries the bypass secret. */
export const COMING_SOON_BYPASS_COOKIE = 'zapletane_preview'

/** `/?preview=<secret>` — the query param that mints the cookie. */
export const COMING_SOON_PREVIEW_PARAM = 'preview'

/** 30 days, same as the original. */
export const COMING_SOON_BYPASS_MAX_AGE = 60 * 60 * 24 * 30
