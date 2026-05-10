'use client'

import { ApiError, getApiBaseUrl, loginRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function sellerLoginHref(): string | undefined {
  const b = process.env.NEXT_PUBLIC_SELLER_WEB_URL?.replace(/\/$/, '')
  if (b) return `${b}/login`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3001/login'
  return undefined
}

function adminLoginHref(): string | undefined {
  const b = process.env.NEXT_PUBLIC_ADMIN_WEB_URL?.replace(/\/$/, '')
  if (b) return `${b}/login`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3002/login'
  return undefined
}

export default function WorkerLoginPage() {
  const router = useRouter()
  const sellerHref = sellerLoginHref()
  const adminHref = adminLoginHref()
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setErr(new URLSearchParams(window.location.search).get('error'))
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const data = await loginRequest({ email, password })
      if (!['WORKER', 'DELIVERY_WORKER'].includes(data.user.role)) {
        setMessage('Seller ya admin app use karein.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Galat credentials.')
      } else if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('API connect nahi ho raha — network / CORS check karein.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Worker login</h1>
          <p className="mt-1 text-xs text-muted-foreground">Field / delivery · port 3003</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {getApiBaseUrl()}
            </code>
          </p>
        </div>
        {err === 'wrong_role' ? (
          <p className="mt-4 text-sm text-destructive">Sirf WORKER / DELIVERY_WORKER.</p>
        ) : null}
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
        <form className="mt-6 flex flex-col gap-4 text-sm" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            Email
            <input
              className="rounded-md border bg-background px-3 py-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            Password
            <input
              className="rounded-md border bg-background px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '…' : 'Sign in'}
          </Button>
        </form>
        <Button variant="outline" className="mt-4 w-full" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
      {sellerHref && adminHref ? (
        <p className="text-center text-xs text-muted-foreground">
          <a className="text-primary underline" href={sellerHref}>
            Seller
          </a>
          {' · '}
          <a className="text-primary underline" href={adminHref}>
            Admin
          </a>
        </p>
      ) : null}
    </main>
  )
}
