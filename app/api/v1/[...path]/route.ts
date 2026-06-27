import type { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy-handler'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyToBackend(req, `/api/v1/${path.join('/')}`)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
