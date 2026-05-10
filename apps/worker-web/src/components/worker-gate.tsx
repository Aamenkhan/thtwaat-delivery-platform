'use client'

import { Skeleton } from '@repo/ui'
import { readTokens, readUser } from '@repo/web-core/auth-storage'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const WORKER_ROLES = new Set(['WORKER', 'DELIVERY_WORKER'])

export function WorkerAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const tokens = readTokens()
    const user = readUser()
    if (!tokens?.accessToken || !user) {
      router.replace('/login')
      return
    }
    if (!WORKER_ROLES.has(user.role)) {
      router.replace('/login?error=wrong_role')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center gap-3 p-6">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <p className="text-center text-xs text-muted-foreground">Securing session…</p>
      </div>
    )
  }

  return <>{children}</>
}
