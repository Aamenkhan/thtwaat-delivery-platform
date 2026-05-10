'use client'

import { ThemeProvider, Toaster, TooltipProvider } from '@repo/ui'
import { AppQueryProvider } from '@repo/web-core/providers'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <AppQueryProvider>{children}</AppQueryProvider>
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
