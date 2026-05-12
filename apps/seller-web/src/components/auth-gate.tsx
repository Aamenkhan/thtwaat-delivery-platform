'use client'

import { readUser } from '@repo/web-core/auth-storage'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const COMMERCE_ROLES = new Set(['SELLER', 'HUB_MANAGER'])

export function SellerAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const user = readUser()
    if (!user) {
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

