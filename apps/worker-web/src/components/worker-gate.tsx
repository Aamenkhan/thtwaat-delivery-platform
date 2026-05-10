'use client'

import { readTokens, readUser } from '@repo/web-core/auth-storage'
import Link from 'next/link'
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
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}

export function WorkerNav() {
  return (
    <nav className="flex flex-wrap gap-3 border-b bg-card px-4 py-3 text-sm">
      <Link href="/dashboard" className="font-semibold">
        Worker
      </Link>
      <Link href="/dashboard/routes" className="text-muted-foreground hover:text-foreground">
        My routes
      </Link>
      <Link href="/dashboard/scan" className="text-muted-foreground hover:text-foreground">
        Scan QR
      </Link>
      <Link href="/dashboard/otp" className="text-muted-foreground hover:text-foreground">
        OTP
      </Link>
      <Link href="/dashboard/photo" className="text-muted-foreground hover:text-foreground">
        Proof photo
      </Link>
      <Link href="/dashboard/gps" className="text-muted-foreground hover:text-foreground">
        GPS ping
      </Link>
    </nav>
  )
}
