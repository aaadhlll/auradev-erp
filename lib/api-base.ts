/** API origin — proxy mode in production; direct to :8080 in local dev. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return ''
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const scheme = protocol === 'https:' ? 'https' : 'http'
      return `${scheme}://${hostname}:8080`
    }
  }

  return 'http://localhost:8080'
}
