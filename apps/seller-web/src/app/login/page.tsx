'use client'

import { GoogleLogin } from '@react-oauth/google'
import { ApiError, getApiBaseUrl, googleLoginRequest, loginRequest } from '@repo/web-core/api'
import { clearTokens } from '@repo/web-core/auth-storage'
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
  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  async function handleGoogleSuccess(credential: string) {
    setLoading(true)
    setMessage(null)
    try {
      const data = await googleLoginRequest(credential)
      if (!['SELLER', 'HUB_MANAGER'].includes(data.user.role)) {
        clearTokens()
        setMessage('Use the admin or worker app for this account.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('Could not reach the API. Check your connection and CORS.')
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
      if (!['SELLER', 'HUB_MANAGER'].includes(data.user.role)) {
        clearTokens()
        setMessage('Use the admin or worker app for this account.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Invalid email or password.')
      } else if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('Could not reach the API. Check your connection and CORS.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 size-[480px] rounded-full bg-emerald-500/15 blur-[110px]" />
        <div className="absolute -bottom-40 -left-40 size-[480px] rounded-full bg-primary/15 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(152 72% 40%) 0%, hsl(170 70% 40%) 100%)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Seller Portal</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your shipments</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-7 shadow-premium">
          {/* API badge */}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">API</span>
            <code className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono">{getApiBaseUrl()}</code>
          </div>

          {/* Errors */}
          {err === 'wrong_role' ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <span>⚠</span> Ye portal sirf seller / hub manager ke liye hai.
            </div>
          ) : null}
          {message ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <span>⚠</span> {message}
            </div>
          ) : null}

          <form className="flex flex-col gap-4" onSubmit={onSubmit} id="seller-login-form">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seller-email" className="text-sm font-medium">Email</label>
              <input
                id="seller-email"
                className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                type="email"
                autoComplete="email"
                placeholder="seller@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seller-password" className="text-sm font-medium">Password</label>
              <input
                id="seller-password"
                className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              id="seller-login-submit"
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-xl shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
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
                  text="signin_with"
                />
              </div>
            </>
          ) : null}

          <div className="mt-3 flex flex-col gap-2">
            <Button id="goto-seller-dashboard" variant="outline" className="h-10 w-full rounded-xl" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New seller?{' '}
              <Link id="seller-register-link" href="/register" className="font-medium text-primary underline-offset-2 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Portal links */}
        {adminHref && workerHref ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Other portals:{' '}
            <a id="admin-portal-link" className="text-primary underline underline-offset-2" href={adminHref}>Admin</a>
            {' · '}
            <a id="worker-portal-link" className="text-primary underline underline-offset-2" href={workerHref}>Worker</a>
          </p>
        ) : null}
      </div>
    </main>
  )
}
