function useSameOriginProxy(): boolean {
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') return true
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'false') return false

  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false
    return true
  }

  return process.env.VERCEL === '1' || Boolean(process.env.NEXT_PUBLIC_APP_URL)
}

function desktopApiBaseUrl(): string | null {
  if (typeof window === 'undefined') return null
  const desktop = (window as Window & { mercantileDesktop?: { apiBaseUrl?: string | null } }).mercantileDesktop
  return desktop?.apiBaseUrl?.replace(/\/$/, '') ?? null
}

/** API origin — same-origin proxy in production; direct to :8080 in local dev. */
export function getApiBaseUrl(): string {
  const desktopUrl = desktopApiBaseUrl()
  if (desktopUrl) return desktopUrl

  if (useSameOriginProxy()) {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  }

  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const scheme = protocol === 'https:' ? 'https' : 'http'
      return `${scheme}://${hostname}:8080`
    }
  }

  return process.env.NEXT_PUBLIC_DEV_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8080'
}
