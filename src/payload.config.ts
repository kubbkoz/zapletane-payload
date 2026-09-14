import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'

import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Users } from '@/collections/Users'
import { globalConfigs } from '@/globals'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Database adapter selection.
 *
 * Production (Vercel) sets POSTGRES_URL, so we run on Vercel Postgres/Neon.
 * Anything else (local dev, CI, tests) keeps the file-based SQLite adapter.
 *
 * The two adapters own *separate* migration directories, because their
 * generated SQL is dialect-specific and their snapshots are incompatible:
 *   - src/migrations      -> sqlite  (existing, local)
 *   - src/migrations-pg   -> postgres (new, production)
 *
 * `payload migrate` / `migrate:create` set PAYLOAD_MIGRATING=true, which we use
 * to route migrations over POSTGRES_URL_NON_POOLING (the direct, non-PgBouncer
 * Neon endpoint). Pooled connections are transaction-scoped and unreliable for
 * long DDL transactions; runtime traffic keeps using the pooled POSTGRES_URL.
 */
const postgresURL = process.env.POSTGRES_URL

const isMigrating = process.env.PAYLOAD_MIGRATING === 'true'

const databaseAdapter = postgresURL
  ? vercelPostgresAdapter({
      pool: {
        connectionString: isMigrating
          ? process.env.POSTGRES_URL_NON_POOLING || postgresURL
          : postgresURL,
      },
      // Neon database is shared-per-project; this app lives in its own schema.
      // Undefined falls back to the adapter default ("public").
      schemaName: process.env.PAYLOAD_DB_SCHEMA || undefined,
      migrationDir: path.resolve(dirname, 'migrations-pg'),
      // Migrations own the production schema — never auto-push DDL.
      push: false,
    })
  : sqliteAdapter({
      client: {
        url: process.env.DATABASE_URI || process.env.DATABASE_URL || 'file:./payload.db',
      },
      migrationDir: path.resolve(dirname, 'migrations'),
      // Dev-only convenience: sync schema without a migration. Payload disables
      // this automatically when NODE_ENV=production, where `payload migrate`
      // (run by the `build` script) owns the schema.
      push: process.env.PAYLOAD_DB_PUSH !== 'false',
    })

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
    },
    user: Users.slug,
  },
  collections: [Users, Pages, Categories, Media],
  db: databaseAdapter,
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  //email: nodemailerAdapter(),
  endpoints: [],
  globals: globalConfigs,
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Sharp is now an optional dependency -
  // if you want to resize images, crop, set focal point, etc.
  // make sure to install it and pass it to the config.
  // sharp,
})
