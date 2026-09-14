import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Second one-shot ADMIN_PASSWORD re-application.
 *
 * The first reset (20260914_201800) was consumed by a deploy that ran before
 * the project owner rotated the ADMIN_PASSWORD env value in Vercel, so it
 * re-applied the old, unknown value. The owner has since set a new value;
 * this migration applies it exactly once on the next deploy. Later password
 * changes belong in the admin panel.
 */

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    payload.logger.info(
      '[reset_admin_password_2] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping password reset.',
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
      `[reset_admin_password_2] No user "${adminEmail}" found — nothing to reset.`,
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
    `[reset_admin_password_2] Password for "${adminEmail}" re-applied from ADMIN_PASSWORD env.`,
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentional no-op: the previous password hash is unknown by design.
}
