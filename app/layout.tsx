import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Comfortaa } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { QueryProvider } from '@/lib/query-provider'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const comfortaa = Comfortaa({
  variable: '--font-brand',
  subsets: ['latin'],
  weight: ['700'],
})

export const metadata: Metadata = {
  title: 'Mercantile',
  description: 'Mercantile — Retail & Wholesale SaaS · Nenjankod Supermarket',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${comfortaa.variable} h-full`}>
      <body className="h-full antialiased">
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </body>
    </html>
  )
}
