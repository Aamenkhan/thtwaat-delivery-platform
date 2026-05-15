'use client'

import { GoogleLogin } from '@react-oauth/google'
import { ApiError, getApiBaseUrl, googleLoginRequest, loginRequest } from '@repo/web-core/api'
import { clearTokens, readTokens } from '@repo/web-core/auth-storage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  exchangeWorkerGigSessionFromAccessToken,
  workerFetch,
  WorkerApiError,
} from '../../lib/worker-api'
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

type Tab = 'phone' | 'email'

export default function WorkerLoginPage() {
  const router = useRouter()
  const sellerHref = sellerLoginHref()
  const adminHref = adminLoginHref()
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('phone')

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
      const res = await workerFetch<{
        message: string
        _devOtp?: string
        delivery?: 'whatsapp' | 'log_only'
      }>('/workers/login/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        skipAuth: true,
      })
      setOtpSent(true)
      if (res._devOtp) {
        setMessage(`Dev OTP: ${res._devOtp}`)
      } else if (res.delivery === 'log_only') {
        setMessage(
          'OTP API logs mein hai (Render → Logs). WhatsApp ke liye API par WHATSAPP_* env set karein.'
        )
      } else {
        setMessage(res.message)
      }
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
      const access = readTokens()?.accessToken
      if (!access) {
        setMessage('Login response incomplete — try again.')
        return
      }
      await exchangeWorkerGigSessionFromAccessToken(access)
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError) {
        setMessage(e.message)
      } else if (e instanceof WorkerApiError) {
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
      const access = readTokens()?.accessToken
      if (!access) {
        setMessage('Login response incomplete — try again.')
        return
      }
      await exchangeWorkerGigSessionFromAccessToken(access)
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMessage('Galat credentials.')
      } else if (e instanceof WorkerApiError) {
        setMessage(e.message)
      } else if (e instanceof ApiError) {
        setMessage(e.message)
      } else {
        setMessage('API connect nahi ho raha — network / CORS check karein.')
      }
    } finally {
      setLoading(false)
    }
  }

  const errorMap: Record<string, string> = {
    wrong_role: '⚠️ Sirf WORKER / DELIVERY_WORKER is app mein login kar sakte hain.',
    schema: '⚠️ Production DB schema purana hai (P2022). Admin se contact karein.',
    worker_session: '⚠️ Worker session link nahi ho saka — dubara login karein.',
  }

  return (
    <main
      style={{
        minHeight: '100svh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
              marginBottom: '1rem',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'white',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Thtwaat Field
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Delivery Worker Portal
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          }}
        >
          {/* Error banners */}
          {err && errorMap[err] && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: '#fca5a5',
                fontSize: '0.8125rem',
              }}
            >
              {errorMap[err]}
            </div>
          )}
          {message && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: '#fca5a5',
                fontSize: '0.8125rem',
              }}
            >
              {message}
            </div>
          )}

          {/* Tab switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.375rem',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '14px',
              padding: '0.25rem',
              marginBottom: '1.5rem',
            }}
          >
            {(['phone', 'email'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setMessage(null) }}
                style={{
                  padding: '0.625rem',
                  borderRadius: '11px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: tab === t
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'transparent',
                  color: tab === t ? 'white' : 'rgba(255,255,255,0.5)',
                  boxShadow: tab === t ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
                }}
              >
                {t === 'phone' ? '📱 Phone OTP' : '✉️ Email'}
              </button>
            ))}
          </div>

          {/* Phone OTP tab */}
          {tab === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Mobile Number
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', pointerEvents: 'none' }}>+91</span>
                  <input
                    id="worker-phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    placeholder="9876543210"
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '12px',
                      padding: '0.875rem 1rem 0.875rem 3rem',
                      color: 'white',
                      fontSize: '1rem',
                      outline: 'none',
                      letterSpacing: '0.05em',
                    }}
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  id="send-otp-btn"
                  type="button"
                  disabled={loading || phone.length < 10}
                  onClick={() => void sendPhoneOtp()}
                  style={{
                    width: '100%',
                    padding: '0.9375rem',
                    borderRadius: '14px',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: phone.length < 10 || loading ? 'not-allowed' : 'pointer',
                    background: phone.length < 10 || loading
                      ? 'rgba(255,255,255,0.1)'
                      : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: phone.length < 10 || loading ? 'rgba(255,255,255,0.3)' : 'white',
                    boxShadow: phone.length >= 10 && !loading ? '0 6px 20px rgba(99,102,241,0.4)' : 'none',
                    transition: 'all 0.2s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {loading ? 'Sending…' : 'Send OTP →'}
                </button>
              ) : (
                <>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Enter OTP
                    </label>
                    <input
                      id="worker-otp"
                      inputMode="numeric"
                      autoFocus
                      value={otp}
                      placeholder="• • • • • •"
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '12px',
                        padding: '0.875rem 1rem',
                        color: 'white',
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        outline: 'none',
                        textAlign: 'center',
                        letterSpacing: '0.5em',
                      }}
                    />
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.375rem', textAlign: 'center' }}>
                      OTP sent to +91 {phone}
                    </p>
                  </div>
                  <button
                    id="verify-otp-btn"
                    type="button"
                    disabled={loading || otp.length < 4}
                    onClick={() => void verifyPhoneOtp()}
                    style={{
                      width: '100%',
                      padding: '0.9375rem',
                      borderRadius: '14px',
                      border: 'none',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: otp.length < 4 || loading ? 'not-allowed' : 'pointer',
                      background: otp.length >= 4 && !loading
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'rgba(255,255,255,0.1)',
                      color: otp.length >= 4 && !loading ? 'white' : 'rgba(255,255,255,0.3)',
                      boxShadow: otp.length >= 4 && !loading ? '0 6px 20px rgba(16,185,129,0.4)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {loading ? 'Verifying…' : '✓ Verify & Login'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp('') }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem', cursor: 'pointer', textAlign: 'center', width: '100%' }}
                  >
                    ← Change number
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email tab */}
          {tab === 'email' && (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Email
                </label>
                <input
                  id="worker-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="worker@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    padding: '0.875rem 1rem',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Password
                </label>
                <input
                  id="worker-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    padding: '0.875rem 1rem',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                id="email-login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.9375rem',
                  borderRadius: '14px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: loading ? 'rgba(255,255,255,0.3)' : 'white',
                  boxShadow: !loading ? '0 6px 20px rgba(99,102,241,0.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>
          )}

          {/* Google */}
          {hasGoogleClientId && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={(resp) => {
                    if (resp.credential) handleGoogleSuccess(resp.credential)
                  }}
                  onError={() => setMessage('Google sign-in failed.')}
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                  shape="pill"
                />
              </div>
            </>
          )}

          {/* Footer links */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem' }}>
              नया worker?{' '}
              <Link
                href="/register"
                style={{ color: '#a78bfa', textDecoration: 'underline', fontWeight: 600 }}
              >
                Register करें
              </Link>
            </p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6875rem', marginTop: '0.5rem' }}>
              API: <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '0 4px', borderRadius: '4px' }}>{getApiBaseUrl()}</code>
            </p>
          </div>
        </div>

        {/* Seller / Admin links */}
        {sellerHref && adminHref && (
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
            <a href={sellerHref} style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Seller Portal</a>
            {' · '}
            <a href={adminHref} style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Admin Portal</a>
          </p>
        )}
      </div>
    </main>
  )
}
