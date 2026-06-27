import type { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy-handler'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyToBackend(req, `/uploads/${path.join('/')}`)
}

export const GET = handle
export const HEAD = handle
