import { FeedSettings } from './FeedSettings'
import { Footer } from './Footer'
import { Header } from './Header'
import { Homepage } from './Homepage'
import { SiteSettings } from './SiteSettings'
import { Statistics } from './Statistics'

/**
 * Single source of truth for registered Payload globals.
 *
 * `payload.config.ts` registers every global in this array, and the MCP
 * plugin config (`src/plugins/index.ts`) derives its `globals` tool-exposure
 * map from the same array. Add a new global (e.g. `site-settings`) here only
 * — it is then both wired into Payload *and* exposed to MCP clients
 * (find + update, per the plugin's globals-only-support-find/update rule)
 * without touching either config file again.
 *
 * Výnimka z „find + update": `statistiky` (Z8) je global len naoko — nedrží
 * žiadne dáta, slúži iba ako nosič položky v navigácii a vlastného edit view.
 * Preto má v `src/plugins/index.ts` výslovný strop `find` bez `update`.
 */
export const globalConfigs = [Header, Footer, Homepage, SiteSettings, FeedSettings, Statistics]
