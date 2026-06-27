/** Backend API origin for server-side proxy (Vercel → Railway). */
export function getApiProxyTarget(): string {
  const raw = (
    process.env.API_PROXY_URL ??
    process.env.NEXT_PUBLIC_API_URL
  )?.trim().replace(/\/$/, '')

  if (!raw) {
    throw new Error(
      'API_PROXY_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`API_PROXY_URL is not a valid URL: "${raw}"`)
  }

  if (!parsed.hostname) {
    throw new Error(`API_PROXY_URL has no hostname: "${raw}"`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`API_PROXY_URL must use http or https: "${raw}"`)
  }

  return `${parsed.protocol}//${parsed.host}`
}
