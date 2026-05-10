'use client'

import { getApiBaseUrl, loginRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function adminLoginHref(): string | undefined {
  const b = process.env.NEXT_PUBLIC_ADMIN_WEB_URL?.replace(/\/$/, '')
  if (b) return `${b}/login`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3002/login'
  return undefined
}

function workerLoginHref(): string | undefined {
  const b = process.env.NEXT_PUBLIC_WORKER_WEB_URL?.replace(/\/$/, '')
  if (b) return `${b}/login`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3003/login'
  return undefined
}

export default function LoginPage() {
  const router = useRouter()
  const adminHref = adminLoginHref()
  const workerHref = workerLoginHref()
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
      if (!['SELLER', 'HUB_MANAGER'].includes(data.user.role)) {
        setMessage('Use the admin or worker app for this account.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setMessage('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seller login</h1>
          <p className="mt-1 text-xs text-muted-foreground">Vikretā · port 3001</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {getApiBaseUrl()}
            </code>
          </p>
        </div>
        {err === 'wrong_role' ? (
          <p className="mt-4 text-sm text-destructive">
            Ye portal sirf seller / hub manager ke liye hai.
          </p>
        ) : null}
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
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
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo: tokens <code className="rounded bg-muted px-1">localStorage</code> mein; production
          mein httpOnly cookies use karein.
        </p>
        <Button variant="outline" className="mt-4 w-full" asChild>
          <Link href="/dashboard">Dashboard (agar pehle se login ho)</Link>
        </Button>
      </div>
      {adminHref && workerHref ? (
        <p className="text-center text-xs text-muted-foreground">
          Aur apps:{' '}
          <a className="text-primary underline" href={adminHref}>
            Admin
          </a>
          {' · '}
          <a className="text-primary underline" href={workerHref}>
            Worker
          </a>
        </p>
      ) : null}
    </main>
  )
}
