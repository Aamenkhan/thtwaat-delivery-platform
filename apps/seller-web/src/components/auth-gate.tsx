'use client'

import { readTokens, readUser } from '@repo/web-core/auth-storage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const COMMERCE_ROLES = new Set(['SELLER', 'HUB_MANAGER'])

export function SellerAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const tokens = readTokens()
    const user = readUser()
    if (!tokens?.accessToken || !user) {
      router.replace('/login')
      return
    }
    if (!COMMERCE_ROLES.has(user.role)) {
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

export function SellerNav() {
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])
  return (
    <nav className="flex flex-wrap items-center gap-4 border-b bg-card px-6 py-3 text-sm">
      <Link href="/dashboard" className="font-semibold">
        Seller
      </Link>
      <Link href="/dashboard/shipments" className="text-muted-foreground hover:text-foreground">
        Shipments
      </Link>
      <Link href="/dashboard/analytics" className="text-muted-foreground hover:text-foreground">
        Analytics
      </Link>
      <Link href="/dashboard/returns" className="text-muted-foreground hover:text-foreground">
        Returns
      </Link>
      <Link href="/dashboard/wallet" className="text-muted-foreground hover:text-foreground">
        Wallet
      </Link>
      <span className="ml-auto text-xs text-muted-foreground">{email}</span>
    </nav>
  )
}
