import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Data-only, one-shot migration that re-applies ADMIN_PASSWORD to the admin
 * account identified by ADMIN_EMAIL.
 *
 * Why it exists: the original ADMIN_PASSWORD was stored as a write-only
 * ("sensitive") Vercel env var and its value is unrecoverable, so the account
 * seeded by `20260914_194649_seed_admin` cannot be logged into. The project
 * owner sets a new ADMIN_PASSWORD value in the Vercel project settings before
 * this migration deploys; the next build's `npm run migrate` then applies it
 * exactly once. Later env changes have no effect (migrations never re-run) —
 * subsequent password changes belong in the admin panel.
 */

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    payload.logger.info(
      '[reset_admin_password] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping password reset.',
    )
    return
  }

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
    req,
  })

  if (existing.docs.length === 0) {
    payload.logger.info(
      `[reset_admin_password] No user "${adminEmail}" found — nothing to reset.`,
    )
    return
  }

  await payload.update({
    collection: 'users',
    id: existing.docs[0].id,
    data: { password: adminPassword },
    req,
  })

  payload.logger.info(
    `[reset_admin_password] Password for "${adminEmail}" re-applied from ADMIN_PASSWORD env.`,
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentional no-op: the previous password hash is unknown by design.
}
