import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Next 16 regenerates AGENTS.md / CLAUDE.md at the repo root on every dev
  // run, which would clobber project-owned docs. Opt out.
  agentRules: false,
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        pathname: '/assets/**',
      },
    ],
    qualities: [90, 100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
      // Media uploaded through @payloadcms/storage-vercel-blob is served from
      // the blob store's public host — without this pattern next/image would
      // refuse every production upload (hero, gallery, blog).
      {
        hostname: '**.public.blob.vercel-storage.com',
        protocol: 'https',
      },
    ],
  },
  // ffmpeg-static resolves its ~80MB binary via __dirname at runtime, so Next's
  // file tracing never bundles it into the serverless function on its own and
  // the video-transcode hook would silently no-op in production.
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
  reactStrictMode: true,
  redirects,
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig)
