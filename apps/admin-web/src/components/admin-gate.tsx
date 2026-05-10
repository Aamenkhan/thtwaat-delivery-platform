'use client'

import { readTokens, readUser } from '@repo/web-core/auth-storage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN'])

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const tokens = readTokens()
    const user = readUser()
    if (!tokens?.accessToken || !user) {
      router.replace('/login')
      return
    }
    if (!ADMIN_ROLES.has(user.role)) {
      router.replace('/login?error=wrong_role')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}

export function AdminNav() {
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])
  return (
    <nav className="flex flex-wrap items-center gap-4 border-b bg-card px-6 py-3 text-sm">
      <Link href="/dashboard" className="font-semibold">
        Admin
      </Link>
      <Link href="/dashboard/hubs" className="text-muted-foreground hover:text-foreground">
        Hubs
      </Link>
      <Link href="/dashboard/workers" className="text-muted-foreground hover:text-foreground">
        Workers
      </Link>
      <Link href="/dashboard/live" className="text-muted-foreground hover:text-foreground">
        Live tracking
      </Link>
      <Link href="/dashboard/payouts" className="text-muted-foreground hover:text-foreground">
        Payouts
      </Link>
      <Link href="/dashboard/ops" className="text-muted-foreground hover:text-foreground">
        Operations
      </Link>
      <span className="ml-auto text-xs text-muted-foreground">{email}</span>
    </nav>
  )
}
