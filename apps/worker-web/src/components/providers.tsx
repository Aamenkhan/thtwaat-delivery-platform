'use client'

import type { ReactNode } from 'react'
import { AppQueryProvider } from '@repo/web-core/providers'

export function Providers({ children }: { children: ReactNode }) {
  return <AppQueryProvider>{children}</AppQueryProvider>
}
