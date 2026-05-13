'use client'

import { ApiError, getApiBaseUrl, registerRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PincodeInput } from '../../components/PincodeInput'
import type { PincodeLookupPayload } from '../../hooks/usePincodeLookup'

export default function WorkerRegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 8) {
      setMessage('Password कम से कम 8 अक्षर।')
      return
    }
    if (password !== password2) {
      setMessage('दोनों password मेल नहीं खाते।')
      return
    }
    if (pincode.length !== 6) {
      setMessage('पिनकोड 6 अंक का हो।')
      return
    }
    setLoading(true)
    try {
      const locationBits = [city, state].filter(Boolean).join(', ')
      const composedName =
        fullName.trim() + (locationBits ? ` (${locationBits})` : '')
      await registerRequest({
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        fullName: composedName.trim() || undefined,
        role: 'WORKER',
      })
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage('यह ईमेल पहले से रजिस्टर्ड है — लॉगिन करें।')
      } else if (err instanceof ApiError) {
        setMessage(err.message)
      } else {
        setMessage('सर्वर से जुड़ नहीं सके — नेटवर्क चेक करें।')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Worker रजिस्टर</h1>
          <p className="mt-1 text-xs text-muted-foreground">फील्ड / डिलीवरी खाता</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{getApiBaseUrl()}</code>
          </p>
        </div>
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
        <form className="mt-6 flex flex-col gap-4 text-sm" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            पूरा नाम
            <input
              className="rounded-md border bg-background px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            फोन (वैकल्पिक)
            <input
              className="rounded-md border bg-background px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <PincodeInput
            id="worker-service-pin"
            fieldLabel="सेवा क्षेत्र पिनकोड"
            value={pincode}
            onChange={setPincode}
            onPincodeResolved={(p: PincodeLookupPayload) => {
              setCity(p.city)
              setState(p.state)
            }}
          />
          {city ? (
            <p className="text-xs text-muted-foreground">
              सेवा क्षेत्र: {city}, {state}
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            ईमेल
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
            पासवर्ड (कम से कम 8)
            <input
              className="rounded-md border bg-background px-3 py-2"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label className="flex flex-col gap-1">
            पासवर्ड दोबारा
            <input
              className="rounded-md border bg-background px-3 py-2"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '…' : 'खाता बनाएं और साइन इन'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          पहले से खाता?{' '}
          <Link href="/login" className="text-primary underline">
            लॉगिन
          </Link>
        </p>
      </div>
    </main>
  )
}
