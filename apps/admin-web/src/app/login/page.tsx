'use client'

import { loginRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminLoginPage() {
  const router = useRouter()
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
      if (!['ADMIN', 'SUPER_ADMIN'].includes(data.user.role)) {
        setMessage('Is account ke liye seller ya worker app kholein.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setMessage('Email ya password galat hai.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin login</h1>
          <p className="mt-1 text-xs text-muted-foreground">Operations · port 3002</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}
            </code>
          </p>
        </div>
        {err === 'wrong_role' ? (
          <p className="mt-4 text-sm text-destructive">Yahan sirf ADMIN / SUPER_ADMIN.</p>
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
        <Button variant="outline" className="mt-4 w-full" asChild>
          <Link href="/dashboard">Dashboard (agar session ho)</Link>
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        <a className="text-primary underline" href="http://localhost:3001/login">
          Seller (3001)
        </a>
        {' · '}
        <a className="text-primary underline" href="http://localhost:3003/login">
          Worker (3003)
        </a>
      </p>
    </main>
  )
}
