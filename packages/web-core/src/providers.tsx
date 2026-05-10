'use client'

import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: number }).status === 401
      ) {
        return false
      }
      return failureCount < 2
    },
  },
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
