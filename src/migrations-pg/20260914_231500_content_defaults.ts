import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only migration (no schema changes) that finishes W2's "zero visual
 * change" contract on a database that already has rows.
 *
 * `20260914_230125_content_management` is purely additive, and every new
 * *scalar* column carries the old hard-coded string as its SQL DEFAULT — which
 * Postgres backfills into the existing `footer` / `site_settings` rows. The two
 * new *array* tables (`footer_social_links`, `header_top_bar_links`) cannot be
 * backfilled that way: they start empty, so the storefront falls back to its
 * baked constants (correct on screen) while the admin form shows an empty list
 * (confusing for an editor). This fills them with exactly the values the
 * components used to hard-code, and only when they are still empty.
 *
 * It also grants the new `homepage` global to the production MCP key: the
 * plugin derives its globals map from `globalConfigs`, so the tools exist as
 * soon as the global is registered, but the key's own checkboxes default to
 * FALSE — same situation `20260914_223000_mcp_shipping_payment_grants` fixed
 * for `site-settings`.
 *
 * The values are inlined rather than imported from `src/lib` on purpose: a
 * migration is a snapshot of intent at a point in time and must not start
 * behaving differently when the app's constants are later edited.
 *
 * Idempotent and non-destructive — re-running `npm run migrate` is safe. The
 * `homepage` global itself needs no seeding: it has never been saved, and
 * `findGlobal` returns the field defaults for an unsaved global.
 */

const globalFullAccess = { find: true, update: true }

const KEY_LABEL = 'Production MCP key'

const SOCIAL_LINKS = [
  { platform: 'facebook' as const, url: '#' },
  { platform: 'instagram' as const, url: 'https://instagram.com/zapletane' },
  { platform: 'youtube' as const, url: '#' },
]

const TOP_BAR_LINKS = [
  { href: '/blog', highlight: true, icon: 'BookOpen' as const, label: 'Zapletane Blog' },
  { href: '/kontakty', highlight: false, icon: 'none' as const, label: 'Kontakty' },
  {
    href: '/vsetko-o-nakupe',
    highlight: false,
    icon: 'none' as const,
    label: 'Všetko o nákupe',
  },
  { href: '/o-nas', highlight: false, icon: 'none' as const, label: 'O nás' },
]

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: { homepage: globalFullAccess },
      req,
    })

    payload.logger.info(
      `[content_defaults] Granted the homepage global to MCP key doc (id=${doc.id}).`,
    )
  }

  if (docs.length === 0) {
    payload.logger.info(
      `[content_defaults] No "${KEY_LABEL}" document found — no MCP grant to widen.`,
    )
  }

  const footer = await payload.findGlobal({ slug: 'footer', depth: 0, req })

  if (!footer?.socialLinks?.length) {
    await payload.updateGlobal({ slug: 'footer', data: { socialLinks: SOCIAL_LINKS }, req })
    payload.logger.info('[content_defaults] Seeded footer social links.')
  }

  const header = await payload.findGlobal({ slug: 'header', depth: 0, req })

  if (!header?.topBar?.links?.length) {
    await payload.updateGlobal({
      slug: 'header',
      data: { topBar: { links: TOP_BAR_LINKS } },
      req,
    })
    payload.logger.info('[content_defaults] Seeded header top-bar links.')
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  const noAccess = { find: false, update: false }

  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys',
    limit: 10,
    req,
    where: { label: { equals: KEY_LABEL } },
  })

  for (const doc of docs) {
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: { homepage: noAccess },
      req,
    })
  }

  payload.logger.info(
    '[content_defaults] Revoked the homepage MCP grant (seeded content left intact).',
  )
}
