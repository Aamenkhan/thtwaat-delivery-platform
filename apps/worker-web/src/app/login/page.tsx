'use client'

import { GoogleLogin } from '@react-oauth/google'
import { ApiError, getApiBaseUrl, googleLoginRequest, loginRequest } from '@repo/web-core/api'
import { clearTokens } from '@repo/web-core/auth-storage'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { workerFetch, WorkerApiError } from '../../lib/worker-api'
import { writeWorkerSession } from '../../lib/worker-session'

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
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  async function sendPhoneOtp() {
    setLoading(true)
    setMessage(null)
    try {
      await workerFetch<{ message: string }>('/workers/login/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        skipAuth: true,
      })
      setOtpSent(true)
    } catch (e) {
      setMessage(e instanceof WorkerApiError ? e.message : 'OTP request failed')
    } finally {
      setLoading(false)
    }
  }

  async function verifyPhoneOtp() {
    setLoading(true)
    setMessage(null)
    try {
      const data = await workerFetch<{
        token: string
        worker: { id: string }
      }>('/workers/login/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
        skipAuth: true,
      })
      writeWorkerSession(data.token, data.worker.id)
      router.replace('/dashboard')
    } catch (e) {
      setMessage(e instanceof WorkerApiError ? e.message : 'Verify failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setLoading(true)
    setMessage(null)
    try {
      const data = await googleLoginRequest(credential)
      if (!['WORKER', 'DELIVERY_WORKER'].includes(data.user.role)) {
        clearTokens()
        setMessage('Seller ya admin app use karein.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('API connect nahi ho raha — network / CORS check karein.')
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
      if (!['WORKER', 'DELIVERY_WORKER'].includes(data.user.role)) {
        clearTokens()
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
          <p className="mt-1 text-xs text-muted-foreground">Phone OTP · field app</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{getApiBaseUrl()}</code>
          </p>
        </div>
        {err === 'wrong_role' ? (
          <p className="mt-4 text-sm text-destructive">Sirf WORKER / DELIVERY_WORKER.</p>
        ) : null}
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}

        <div className="mt-6 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            Mobile (10 digits)
            <input
              className="min-h-12 rounded-md border bg-background px-3 py-3 text-base"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          {!otpSent ? (
            <Button
              type="button"
              className="h-12 w-full text-base"
              disabled={loading || phone.length < 10}
              onClick={() => void sendPhoneOtp()}
            >
              Send OTP
            </Button>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                OTP
                <input
                  className="min-h-12 rounded-md border bg-background px-3 py-3 text-center text-2xl tracking-widest"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={loading || otp.length < 4}
                onClick={() => void verifyPhoneOtp()}
              >
                Verify &amp; continue
              </Button>
            </>
          )}
        </div>

        <div className="relative my-6 flex items-center">
          <div className="flex-1 border-t border-border" />
          <span className="mx-3 text-xs text-muted-foreground">or email</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form className="flex flex-col gap-4 text-sm" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            Email
            <input
              className="min-h-12 rounded-md border bg-background px-3 py-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            Password
            <input
              className="min-h-12 rounded-md border bg-background px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={loading} className="h-12 w-full">
            {loading ? '…' : 'Sign in with email'}
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
        <Button variant="outline" className="mt-4 w-full" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          नया worker?{' '}
          <Link href="/register" className="text-primary underline">
            रजिस्टर
          </Link>
        </p>
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
