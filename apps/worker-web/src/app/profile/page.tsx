'use client'

import { Button, Skeleton } from '@repo/ui'
import { Copy, LogOut, Camera, CheckCircle2, Clock, Pencil, X, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { workerFetch } from '../../lib/worker-api'
import { clearWorkerSession, readWorkerId } from '../../lib/worker-session'
import { clearTokens, readTokens } from '@repo/web-core/auth-storage'
import { logoutRequest } from '@repo/web-core/api'

type W = {
  id: string
  displayName: string
  phone: string | null
  role: string
  isVerified: boolean
  address: string | null
  city: string | null
  pincode: string | null
  vehicleType: string | null
  vehicleNumber: string | null
  upiId: string | null
  bankAccount: string | null
  bankIfsc: string | null
  aadhaarNumber: string | null
  drivingLicenseNo: string | null
  photoUrl: string | null
  aadhaarPhotoUrl: string | null
  drivingLicenseUrl: string | null
  todayEarnings: number
  monthEarnings: number
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <div
        style={{
          width: '88px',
          height: '88px',
          borderRadius: '50%',
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '3px solid rgba(99,102,241,0.5)',
          boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
        }}
      />
    )
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      style={{
        width: '88px',
        height: '88px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: 700,
        color: 'white',
        border: '3px solid rgba(99,102,241,0.5)',
        boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
        flexShrink: 0,
      }}
    >
      {initials || '?'}
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '20px',
  padding: '1.25rem 1.5rem',
  backdropFilter: 'blur(10px)',
}

const label: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.25rem',
}

const value: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: 'rgba(255,255,255,0.9)',
  fontWeight: 500,
}

const FIELDS = [
  ['name', 'Display name'],
  ['address', 'Address'],
  ['city', 'City'],
  ['pincode', 'PIN code'],
  ['vehicleType', 'Vehicle type'],
  ['vehicleNumber', 'Vehicle number'],
  ['upiId', 'UPI ID'],
  ['aadhaarNumber', 'Aadhaar (digits only)'],
  ['drivingLicenseNo', 'Driving licence no.'],
  ['bankAccount', 'Bank account'],
  ['bankIfsc', 'Bank IFSC'],
] as const

export default function ProfilePage() {
  const router = useRouter()
  // ✅ FIX: must call setId on mount to read from localStorage (SSR returns null)
  const [id, setId] = useState<string | null | undefined>(undefined)
  const [w, setW] = useState<W | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    vehicleType: '',
    vehicleNumber: '',
    upiId: '',
    aadhaarNumber: '',
    drivingLicenseNo: '',
    bankAccount: '',
    bankIfsc: '',
  })

  // ✅ FIX: read workerId from localStorage on client mount
  useEffect(() => {
    setId(readWorkerId())
  }, [])

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const p = await workerFetch<W>(`/workers/${id}/profile`)
        setW(p)
        setForm({
          name: p.displayName ?? '',
          address: p.address ?? '',
          city: p.city ?? '',
          pincode: p.pincode ?? '',
          vehicleType: p.vehicleType ?? '',
          vehicleNumber: p.vehicleNumber ?? '',
          upiId: p.upiId ?? '',
          aadhaarNumber: p.aadhaarNumber?.replace(/\D/g, '') ?? '',
          drivingLicenseNo: p.drivingLicenseNo ?? '',
          bankAccount: p.bankAccount ?? '',
          bankIfsc: p.bankIfsc ?? '',
        })
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed to load profile')
      }
    })()
  }, [id])

  async function saveProfile() {
    if (!id) return
    setBusy(true)
    setMsg(null)
    setOkMsg(null)
    try {
      await workerFetch(`/workers/${id}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
          vehicleType: form.vehicleType.trim() || undefined,
          vehicleNumber: form.vehicleNumber.trim() || undefined,
          upiId: form.upiId.trim() || undefined,
          aadhaarNumber: form.aadhaarNumber.replace(/\D/g, '') || undefined,
          drivingLicenseNo: form.drivingLicenseNo.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          bankIfsc: form.bankIfsc.trim() || undefined,
        }),
      })
      const p = await workerFetch<W>(`/workers/${id}/profile`)
      setW(p)
      setOkMsg('✓ Profile saved successfully.')
      setEditing(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function copyId() {
    if (!w?.id || !navigator.clipboard) return
    await navigator.clipboard.writeText(w.id)
    setOkMsg('✓ Worker ID copied to clipboard.')
    setTimeout(() => setOkMsg(null), 3000)
  }

  async function logout() {
    clearWorkerSession()
    try {
      if (readTokens()?.accessToken) await logoutRequest()
    } catch {
      clearTokens()
    }
    router.replace('/login')
    router.refresh()
  }

  // SSR hydration wait
  if (id === undefined) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '2rem' }}>
          <Skeleton className="h-8 w-40 rounded-lg mb-4" />
          <Skeleton className="h-40 w-full rounded-2xl mb-3" />
          <Skeleton className="h-24 w-full rounded-2xl mb-3" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!id) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>Session expired.</p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Login करें →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        paddingBottom: '6rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>
          My Profile
        </h1>
        <button
          type="button"
          onClick={() => void logout()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            padding: '0.5rem 0.875rem',
            color: '#fca5a5',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Toast messages */}
        {msg && (
          <div
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {msg}
          </div>
        )}
        {okMsg && (
          <div
            style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#6ee7b7',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={16} />
            {okMsg}
          </div>
        )}

        {/* Hero card */}
        <div
          style={{
            ...card,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
            border: '1px solid rgba(99,102,241,0.3)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={w?.displayName ?? 'Worker'} photoUrl={w?.photoUrl ?? null} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {w ? (
                <>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem', margin: 0, lineHeight: 1.2 }}>
                    {w.displayName}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', margin: '0.25rem 0' }}>
                    {w.phone ?? 'No phone'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.625rem',
                        borderRadius: '999px',
                        background: 'rgba(99,102,241,0.3)',
                        color: '#c4b5fd',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {w.role.replace(/_/g, ' ')}
                    </span>
                    {w.isVerified ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.625rem',
                          borderRadius: '999px',
                          background: 'rgba(16,185,129,0.2)',
                          color: '#34d399',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={11} />
                        Verified
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.625rem',
                          borderRadius: '999px',
                          background: 'rgba(245,158,11,0.2)',
                          color: '#fbbf24',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                        }}
                      >
                        <Clock size={11} />
                        Pending
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Skeleton className="h-6 w-32 rounded mb-2" />
                  <Skeleton className="h-4 w-24 rounded" />
                </>
              )}
            </div>
          </div>

          {/* Earnings row */}
          {w && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginTop: '1.25rem',
              }}
            >
              {[
                { l: "Today's Earnings", v: `₹${(w.todayEarnings ?? 0).toFixed(0)}`, c: '#34d399' },
                { l: "This Month", v: `₹${(w.monthEarnings ?? 0).toFixed(0)}`, c: '#60a5fa' },
              ].map((s) => (
                <div
                  key={s.l}
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{s.l}</p>
                  <p style={{ color: s.c, fontSize: '1.375rem', fontWeight: 800, margin: '0.25rem 0 0' }}>{s.v}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Worker ID card */}
        {w && (
          <div style={{ ...card, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <p style={label}>Worker ID (Hub OTP)</p>
                <code style={{ ...value, fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.id}
                </code>
              </div>
              <button
                type="button"
                id="copy-worker-id"
                onClick={() => void copyId()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexShrink: 0,
                  background: 'rgba(99,102,241,0.2)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.875rem',
                  color: '#a78bfa',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Info sections */}
        {w && !editing && (
          <>
            <div style={{ ...card, marginBottom: '1rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>📍 Personal & Address</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  ['Address', w.address || '—'],
                  ['City', w.city || '—'],
                  ['PIN Code', w.pincode || '—'],
                  ['Aadhaar', w.aadhaarNumber ? `••••${w.aadhaarNumber.slice(-4)}` : '—'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={label}>{l}</p>
                    <p style={value}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, marginBottom: '1rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>🚗 Vehicle</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  ['Type', w.vehicleType || '—'],
                  ['Number', w.vehicleNumber || '—'],
                  ['DL No.', w.drivingLicenseNo || '—'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={label}>{l}</p>
                    <p style={value}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, marginBottom: '1rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>💳 Payment</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  ['UPI ID', w.upiId || '—'],
                  ['Bank Account', w.bankAccount ? `${w.bankAccount.slice(0, 4)}••••` : '—'],
                  ['IFSC', w.bankIfsc || '—'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={label}>{l}</p>
                    <p style={value}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Document links */}
            {(w.aadhaarPhotoUrl || w.drivingLicenseUrl) && (
              <div style={{ ...card, marginBottom: '1rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.875rem' }}>📄 Documents</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {w.aadhaarPhotoUrl && (
                    <a href={w.aadhaarPhotoUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#a78bfa', fontSize: '0.875rem', textDecoration: 'none', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      View Aadhaar photo <ChevronRight size={16} />
                    </a>
                  )}
                  {w.drivingLicenseUrl && (
                    <a href={w.drivingLicenseUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#a78bfa', fontSize: '0.875rem', textDecoration: 'none', padding: '0.5rem 0' }}>
                      View Driving Licence <ChevronRight size={16} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Edit button */}
            <button
              type="button"
              id="edit-profile-btn"
              onClick={() => setEditing(true)}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                fontSize: '0.9375rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
                marginBottom: '1rem',
              }}
            >
              <Pencil size={16} />
              Edit Profile
            </button>

            {/* Photo upload link */}
            <div style={{ ...card, marginBottom: '1rem' }}>
              <Link
                href="/dashboard/photo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: 'white',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={20} style={{ color: '#a78bfa' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Upload Photo / Documents</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>Profile photo, Aadhaar, DL</p>
                </div>
                <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </Link>
            </div>
          </>
        )}

        {/* Edit form */}
        {editing && (
          <div style={{ ...card, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>✏️ Update Details</p>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {FIELDS.map(([key, lbl]) => (
                <div key={key}>
                  <label style={label}>{lbl}</label>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      color: 'white',
                      fontSize: '0.9375rem',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                id="save-profile-btn"
                disabled={busy || !form.name.trim()}
                onClick={() => void saveProfile()}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: busy || !form.name.trim()
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  color: busy || !form.name.trim() ? 'rgba(255,255,255,0.3)' : 'white',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: busy || !form.name.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: !busy && form.name.trim() ? '0 6px 20px rgba(16,185,129,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {busy ? 'Saving…' : '✓ Save Profile'}
              </button>
            </div>
          </div>
        )}

        <Button variant="outline" asChild className="w-full">
          <Link href="/dashboard">← Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
