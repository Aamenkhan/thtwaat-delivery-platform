'use client'

import { ApiError, getApiBaseUrl, registerRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 8) {
      setMessage('Password kam se kam 8 characters ka ho.')
      return
    }
    if (password !== password2) {
      setMessage('Dono password match nahi kar rahe.')
      return
    }
    setLoading(true)
    try {
      await registerRequest({
        email: email.trim(),
        password,
        companyName: companyName.trim() || undefined,
      })
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage('Ye email pehle se registered hai — login try karein.')
      } else if (err instanceof ApiError) {
        setMessage(err.message)
      } else {
        setMessage('API tak nahi pahunch sakay — network / CORS check karein.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seller register</h1>
          <p className="mt-1 text-xs text-muted-foreground">Naya account — production DB par save hota hai</p>
          <p className="mt-2 text-sm text-muted-foreground">
            API:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{getApiBaseUrl()}</code>
          </p>
        </div>
        {message ? <p className="mt-4 text-sm text-destructive">{message}</p> : null}
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-sm">
            Company (optional)
            <input
              className="rounded-md border bg-background px-3 py-2"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
          </label>
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
            Password (min 8)
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
          <label className="flex flex-col gap-1 text-sm">
            Password dubara
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
            {loading ? 'Creating…' : 'Create account & sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pehle se account?{' '}
          <Link href="/login" className="text-primary underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}
