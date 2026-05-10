'use client'

import { readTokens, readUser } from '@repo/web-core/auth-storage'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@repo/ui'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN'])

const NAV: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/sellers', label: 'Sellers' },
  { href: '/dashboard/shipments', label: 'Shipments' },
  { href: '/dashboard/live', label: 'Live tracking' },
  { href: '/dashboard/hubs', label: 'Hubs' },
  { href: '/dashboard/zones', label: 'Zones' },
  { href: '/dashboard/workers', label: 'Workers' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/cod', label: 'COD' },
  { href: '/dashboard/pricing', label: 'Pricing' },
  { href: '/dashboard/payouts', label: 'Payouts' },
  { href: '/dashboard/ops', label: 'Ops' },
]

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
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])
  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-6">
        <span className="mr-2 text-sm font-semibold">Admin</span>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm transition-colors',
              pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{email}</span>
      </div>
    </nav>
  )
}
