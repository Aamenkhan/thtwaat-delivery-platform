'use client'

import { Skeleton } from '@repo/ui'
import { clearTokens, readTokens, readUser } from '@repo/web-core/auth-storage'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN'])

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const user = readUser()
    const tokens = readTokens()
    if (!user?.email || !tokens?.accessToken) {
      clearTokens()
      router.replace('/login')
      return
    }
    if (!ADMIN_ROLES.has(user.role)) {
      clearTokens()
      router.replace('/login?error=wrong_role')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-col justify-center gap-3 p-8">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <p className="text-center text-xs text-muted-foreground">Loading operations console…</p>
      </div>
    )
  }

  return <>{children}</>
}
