'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type Order = { id: string; publicId: string; qrCode: string; status: string }

export default function OtpPage() {
  const routes = useQuery({
    queryKey: ['worker', 'routes'],
    queryFn: () => apiFetch<{ data: { orders: Order[] } }>('/v1/workers/me/routes'),
  })
  const me = useQuery({
    queryKey: ['worker', 'me'],
    queryFn: () =>
      apiFetch<{ data: { worker: { id: string } } }>('/v1/workers/me'),
  })

  const [orderId, setOrderId] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devHint, setDevHint] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function requestOtp() {
    setMsg(null)
    setDevHint(null)
    try {
      const res = await apiFetch<{
        ok: true
        data: { sent: boolean; _devCode?: string }
      }>('/v1/otp/request', {
        method: 'POST',
        anonymous: true,
        body: {
          phone,
          purpose: 'DELIVERY_COMPLETION',
          orderId: orderId || undefined,
        },
      })
      if (res.data._devCode) setDevHint(`Dev OTP: ${res.data._devCode}`)
      else setMsg('OTP sent (check SMS in production).')
    } catch {
      setMsg('OTP request failed.')
    }
  }

  async function verifyOtp() {
    setMsg(null)
    const order = routes.data?.data.orders.find((o) => o.id === orderId)
    const workerId = me.data?.data.worker.id
    if (!order || !workerId) {
      setMsg('Select a valid order from your routes and ensure profile loaded.')
      return
    }
    try {
      await apiFetch('/v1/otp/verify', {
        method: 'POST',
        anonymous: true,
        body: {
          phone,
          code,
          purpose: 'DELIVERY_COMPLETION',
          orderId: order.id,
          workerId,
          qrCode: order.qrCode,
          latitude: 0,
          longitude: 0,
        },
      })
      setMsg('OTP verified. If order was OUT_FOR_DELIVERY it is now DELIVERED.')
    } catch {
      setMsg('Verify failed (code, order state, or purpose).')
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-xl font-semibold">OTP delivery</h1>
      <label className="flex flex-col gap-1">
        Order (from my routes)
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        >
          <option value="">Select…</option>
          {(routes.data?.data.orders ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.publicId} · {o.status}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Customer phone
        <input
          className="rounded-md border px-2 py-1"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="matches order / OTP request"
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => void requestOtp()}>
        Request OTP
      </Button>
      {devHint ? <p className="text-xs text-primary">{devHint}</p> : null}
      <label className="flex flex-col gap-1">
        Code
        <input
          className="rounded-md border px-2 py-1"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <Button type="button" onClick={() => void verifyOtp()}>
        Verify OTP
      </Button>
      {msg ? <p className="text-xs">{msg}</p> : null}
    </div>
  )
}
