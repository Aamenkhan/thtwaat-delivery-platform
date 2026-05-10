import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '../components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Field Worker',
  description: 'Delivery worker app',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
