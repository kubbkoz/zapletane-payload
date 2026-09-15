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

import { en } from '@payloadcms/translations/languages/en'
import { sk } from '@payloadcms/translations/languages/sk'

import { Categories } from '@/collections/Categories'
import { DiscountCodes } from '@/collections/DiscountCodes'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { PaymentMethods } from '@/collections/PaymentMethods'
import { Posts } from '@/collections/Posts'
import { ProductFilters } from '@/collections/ProductFilters'
import { ProductProperties } from '@/collections/ProductProperties'
import { PushSubscriptions } from '@/collections/PushSubscriptions'
import { ScraperJobs } from '@/collections/ScraperJobs'
import { ShippingMethods } from '@/collections/ShippingMethods'
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
      // Slovak intro above the login form.
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      // Nástenka, zhora nadol (Z8): uvítacia karta → posledné objednávky →
      // súhrn štatistík → predvolené karty kolekcií, ktoré Payload vykreslí
      // hneď za týmto poľom (ModularDashboard).
      beforeDashboard: [
        '@/components/BeforeDashboard#BeforeDashboard',
        '@/components/admin/RecentOrders#RecentOrders',
        '@/components/admin/StatsSummary#StatsSummary',
      ],
      graphics: {
        // ZAPLETANE mark in the nav / step-nav "home" link (18×18 box).
        Icon: '@/components/admin/Icon#Icon',
        // ZAPLETANE wordmark on the login screen, replacing the Payload logo.
        Logo: '@/components/admin/Logo#Logo',
      },
      // Pulls the self-hosted @fontsource CSS (DM Sans + Unbounded) into the
      // admin bundle. RootLayout renders providers around every admin view,
      // login included — the `(payload)` route group never loads the
      // storefront's globals.css, so this is the only place the admin gets the
      // brand webfonts. See src/components/admin/BrandFonts.
      providers: ['@/components/admin/BrandFonts#BrandFonts'],
    },
    meta: {
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/favicon.svg' }],
      // Payload joins title + suffix with a space (`${title} ${suffix}`), so no
      // leading space here — renders as e.g. "Dashboard · ZAPLETANE admin".
      titleSuffix: '· ZAPLETANE admin',
    },
    // Both themes are branded in src/app/(payload)/custom.scss, so leave the
    // built-in light/dark switch in the account settings available to users.
    // ('all' is also the Payload default — stated explicitly so it is not
    // narrowed by accident.)
    theme: 'all',
    user: Users.slug,
  },
  collections: [
    Users,
    Pages,
    // Blog (Z7) — rovnaký tvar ako Pages, len s vlastnou adresou /blog/<slug>.
    Posts,
    Categories,
    Media,
    ShippingMethods,
    PaymentMethods,
    DiscountCodes,
    ProductFilters,
    ProductProperties,
    // Z12 — import produktov z cudzieho e-shopu (scraper + preklad + ceny).
    ScraperJobs,
    PushSubscriptions,
  ],
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
  i18n: {
    fallbackLanguage: 'sk',
    supportedLanguages: { en, sk },
  },
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
