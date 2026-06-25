import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const lanOrigins = (process.env.NEXT_DEV_LAN_ORIGIN ?? '192.168.1.9')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  // Next.js blocks /_next dev assets from LAN hosts unless listed here.
  allowedDevOrigins: lanOrigins,
  // Pin workspace root — avoids picking C:\Users\T480\package-lock.json as monorepo root.
  turbopack: {
    root: projectRoot,
  },
}

export default nextConfig
