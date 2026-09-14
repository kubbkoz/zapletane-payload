import { Footer } from './Footer'
import { Header } from './Header'

/**
 * Single source of truth for registered Payload globals.
 *
 * `payload.config.ts` registers every global in this array, and the MCP
 * plugin config (`src/plugins/index.ts`) derives its `globals` tool-exposure
 * map from the same array. Add a new global (e.g. `site-settings`) here only
 * — it is then both wired into Payload *and* exposed to MCP clients
 * (find + update, per the plugin's globals-only-support-find/update rule)
 * without touching either config file again.
 */
export const globalConfigs = [Header, Footer]
