import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { QueryProvider } from '@/lib/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mercantile',
  description: 'Mercantile — Retail & Wholesale SaaS · Nenjankod Supermarket',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </body>
    </html>
  )
}
