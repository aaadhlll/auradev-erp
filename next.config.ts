import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const lanOrigins = (process.env.NEXT_DEV_LAN_ORIGIN ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const apiProxyUrl = process.env.API_PROXY_URL?.replace(/\/$/, '')

const nextConfig: NextConfig = {
  // Lets CI or a production verification build run beside `next dev` without
  // competing for the same generated .next directory.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // Electron packages the standalone Next server and runs it on localhost.
  output: 'standalone',
  // Next.js blocks /_next dev assets from LAN hosts unless listed here.
  allowedDevOrigins: lanOrigins,
  // Pin workspace root — avoids picking C:\Users\T480\package-lock.json as monorepo root.
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    if (!apiProxyUrl) return []
    return [
      { source: '/api/v1/:path*', destination: `${apiProxyUrl}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${apiProxyUrl}/uploads/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
