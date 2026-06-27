import { NextRequest, NextResponse } from 'next/server'
import { getApiProxyTarget } from './api-proxy-target'

const HOP_BY_HOP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers()
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) return
    // Let fetch compute content-length from the forwarded body stream/buffer.
    headers.set(key, value)
  })
  return headers
}

async function buildUpstreamBody(req: NextRequest): Promise<BodyInit | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  // Prefer streaming the raw body so multipart boundaries stay intact (logo/import uploads).
  if (req.body) return req.body
  const buf = await req.arrayBuffer()
  return buf.byteLength > 0 ? buf : undefined
}

export async function proxyToBackend(
  req: NextRequest,
  upstreamPath: string,
): Promise<NextResponse> {
  let target: string
  try {
    target = getApiProxyTarget()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API proxy is not configured'
    return NextResponse.json({ message }, { status: 503 })
  }

  const url = `${target}${upstreamPath}${req.nextUrl.search}`
  const headers = buildUpstreamHeaders(req)
  const body = await buildUpstreamBody(req)

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      // Required when forwarding a streaming request body (multipart uploads).
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const resHeaders = new Headers()
    res.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        resHeaders.set(key, value)
      }
    })

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Upstream fetch failed'
    return NextResponse.json(
      {
        message: 'Could not reach the API server. Check API_PROXY_URL on Vercel and that the backend is running.',
        detail,
        upstream: target,
      },
      { status: 502 },
    )
  }
}
