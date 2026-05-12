'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider, Toaster, TooltipProvider } from '@repo/ui'
import { AppQueryProvider } from '@repo/web-core/providers'
import type { ReactNode } from 'react'

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

export function Providers({ children }: { children: ReactNode }) {
  const inner = (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <AppQueryProvider>{children}</AppQueryProvider>
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )

  if (!googleClientId) return inner

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {inner}
    </GoogleOAuthProvider>
  )
}
