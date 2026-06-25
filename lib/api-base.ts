/** API origin — follows the browser host on LAN so mobile works without extra env. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const scheme = protocol === 'https:' ? 'https' : 'http'
      return `${scheme}://${hostname}:8080`
    }
  }

  return 'http://localhost:8080'
}
