'use client'

import { Skeleton } from '@repo/ui'
import { clearTokens, readTokens, readUser } from '@repo/web-core/auth-storage'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { exchangeWorkerGigSessionFromAccessToken, WorkerApiError } from '../lib/worker-api'
import { readWorkerToken } from '../lib/worker-session'

const WORKER_ROLES = new Set(['WORKER', 'DELIVERY_WORKER'])

export function WorkerAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (readWorkerToken()) {
        if (!cancelled) setReady(true)
        return
      }
      const user = readUser()
      const tokens = readTokens()
      if (!user?.email || !tokens?.accessToken) {
        clearTokens()
        if (!cancelled) router.replace('/login')
        return
      }
      if (!WORKER_ROLES.has(user.role)) {
        clearTokens()
        if (!cancelled) router.replace('/login?error=wrong_role')
        return
      }
      try {
        await exchangeWorkerGigSessionFromAccessToken(tokens.accessToken)
        if (!cancelled) setReady(true)
      } catch (e) {
        clearTokens()
        const schema =
          e instanceof WorkerApiError &&
          (e.message.includes('P2022') || e.message.toLowerCase().includes('schema'))
        if (!cancelled) {
          router.replace(schema ? '/login?error=schema' : '/login?error=worker_session')
        }
      }
    })()
    return () => {
      cancelled = true
    }
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
