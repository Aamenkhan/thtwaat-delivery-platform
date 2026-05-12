'use client'

import { GoogleLogin } from '@react-oauth/google'
import { ApiError, getApiBaseUrl, googleLoginRequest, loginRequest } from '@repo/web-core/api'
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

function workerLoginHref(): string | undefined {
  const b = process.env.NEXT_PUBLIC_WORKER_WEB_URL?.replace(/\/$/, '')
  if (b) return `${b}/login`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3003/login'
  return undefined
}

export default function AdminLoginPage() {
  const router = useRouter()
  const sellerHref = sellerLoginHref()
  const workerHref = workerLoginHref()
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setErr(new URLSearchParams(window.location.search).get('error'))
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  async function handleGoogleSuccess(credential: string) {
    setLoading(true)
    setMessage(null)
    try {
      const data = await googleLoginRequest(credential)
      if (!['ADMIN', 'SUPER_ADMIN'].includes(data.user.role)) {
        setMessage('Is account ke liye seller ya worker app kholein.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Google token invalid ya expired.')
      } else if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('API tak nahi pahunch sakay — network / CORS check karein.')
      }
    } finally {
      setLoading(false)
    }
  }

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
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Email ya password galat hai.')
      } else if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('API tak nahi pahunch sakay — network / CORS check karein.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 size-[520px] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/10 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg glow-sm">
            <svg width="24" height="24" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ops Console</h1>
            <p className="mt-1 text-sm text-muted-foreground">Admin — sign in to continue</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-7 shadow-premium">
          {/* API badge */}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">API endpoint</span>
            <code className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-foreground">
              {getApiBaseUrl()}
            </code>
          </div>

          {/* Errors */}
          {err === 'wrong_role' ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <span className="text-base">⚠</span>
              Yahan sirf ADMIN / SUPER_ADMIN.
            </div>
          ) : null}
          {message ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <span className="text-base">⚠</span>
              {message}
            </div>
          ) : null}

          <form className="flex flex-col gap-4" onSubmit={onSubmit} id="admin-login-form">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none ring-ring transition focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none ring-ring transition focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-xl bg-brand-gradient text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {hasGoogleClientId ? (
            <>
              <div className="relative my-4 flex items-center">
                <div className="flex-1 border-t border-border" />
                <span className="mx-3 text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(resp) => {
                    if (resp.credential) handleGoogleSuccess(resp.credential)
                  }}
                  onError={() => setMessage('Google sign-in failed.')}
                  theme="outline"
                  size="large"
                  width="100%"
                  text="signin_with"
                />
              </div>
            </>
          ) : null}

          <Button id="goto-dashboard" variant="outline" className="mt-3 h-10 w-full rounded-xl" asChild>
            <Link href="/dashboard">Go to dashboard (if session exists)</Link>
          </Button>
        </div>

        {/* Portal links */}
        {sellerHref && workerHref ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Other portals:{' '}
            <a id="seller-portal-link" className="text-primary underline underline-offset-2 hover:opacity-80" href={sellerHref}>
              Seller
            </a>
            {' · '}
            <a id="worker-portal-link" className="text-primary underline underline-offset-2 hover:opacity-80" href={workerHref}>
              Worker
            </a>
          </p>
        ) : null}
      </div>
    </main>
  )
}
