'use client'

import { Button } from '@repo/ui'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readUser } from '@repo/web-core/auth-storage'

/**
 * Lightweight account view (JWT user from login). Full seller/company CRUD API is not wired here yet.
 */
export default function SellerAccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const u = readUser()
    setEmail(u?.email ?? null)
    setRole(typeof u?.role === 'string' ? u.role : null)
  }, [])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        यहाँ सिर्फ लॉगिन वाली जानकारी दिखती है। कंपनी नाम / पता बदलने के लिए अभी अलग seller profile API नहीं है —
        नया वर्कस्पेस <Link className="text-primary underline" href="/register">Register</Link> से बनता है।
      </p>
      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="text-muted-foreground">Email</p>
        <p className="mt-1 font-medium">{email ?? '—'}</p>
        {role ? (
          <>
            <p className="mt-3 text-muted-foreground">Role</p>
            <p className="mt-1 font-mono text-xs">{role}</p>
          </>
        ) : null}
      </div>
    </div>
  )
}
