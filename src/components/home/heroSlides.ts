/**
 * Back-compat shim.
 *
 * The homepage's default copy now lives in `src/lib/homeDefaults.ts`, because
 * `src/globals/Homepage.ts` builds its field defaults from the same constants
 * and a Payload config has no business importing from `src/components`.
 * Re-exported here so the original import path keeps working.
 */
export {
  FEATURES,
  HERO_PERKS,
  HERO_SLIDES,
  type HeroPerk,
  type HeroSlide,
  type Hotspot,
  type ValueCard,
} from '@/lib/homeDefaults'
