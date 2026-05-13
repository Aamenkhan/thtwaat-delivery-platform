'use client'

import confetti from 'canvas-confetti'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { uploadOrderPhotoClient } from '../../../lib/supabase-storage-client'
import { workerFetch } from '../../../lib/worker-api'
import { readWorkerId } from '../../../lib/worker-session'

type Order = {
  id: string
  publicId: string
  qrCode: string
  status: string
  pickupWorkerId: string | null
  assignedWorkerId: string | null
  seller: { companyName: string | null }
  customer: { fullName: string; phone: string } | null
  orderItems: { title: string }[]
  pickupLocation: { line1: string; contactPhone: string | null } | null
  sourceHub: { name: string; latitude: number; longitude: number } | null
}

export default function OrderFlowPage() {
  const params = useParams()
  const orderId = String(params.orderId ?? '')
  const wid = readWorkerId()
  const [order, setOrder] = useState<Order | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!orderId || !wid) return
    void (async () => {
      try {
        const o = await workerFetch<Order>(`/orders/${orderId}`)
        setOrder(o)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Load failed')
      }
    })()
  }, [orderId, wid])

  const isPickup = order?.pickupWorkerId === wid
  const isDelivery = order?.assignedWorkerId === wid

  async function pickupInit() {
    if (!order) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await workerFetch<{ sessionId: string }>(
        `/orders/${order.id}/pickup/init`,
        { method: 'POST' }
      )
      setSessionId(r.sessionId)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function pickupScan(file: File | null, manualQr: string) {
    if (!order || !wid) return
    setBusy(true)
    setMsg(null)
    try {
      let photoUrl = ''
      if (file) {
        try {
          photoUrl = await uploadOrderPhotoClient({
            orderId: order.id,
            file,
            prefix: 'pickup',
          })
        } catch {
          setMsg('Supabase env missing — set NEXT_PUBLIC_SUPABASE_* vars.')
          setBusy(false)
          return
        }
      }
      const qr = manualQr.trim() || order.qrCode
      await workerFetch(`/orders/${order.id}/pickup/scan`, {
        method: 'POST',
        body: JSON.stringify({
          qrCode: qr,
          photoUrl: photoUrl || 'https://static.local/missing',
          lat: 0,
          lng: 0,
        }),
      })
      const o = await workerFetch<Order>(`/orders/${order.id}`)
      setOrder(o)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  async function pickupVerify() {
    if (!order) return
    setBusy(true)
    setMsg(null)
    try {
      await workerFetch(`/orders/${order.id}/pickup/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, otp }),
      })
      const o = await workerFetch<Order>(`/orders/${order.id}`)
      setOrder(o)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'OTP failed')
    } finally {
      setBusy(false)
    }
  }

  async function deliveryInit() {
    if (!order) return
    setBusy(true)
    try {
      const r = await workerFetch<{ sessionId: string }>(
        `/orders/${order.id}/delivery/init`,
        { method: 'POST', body: JSON.stringify({ lat: 0, lng: 0 }) }
      )
      setSessionId(r.sessionId)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function deliveryVerify() {
    if (!order) return
    setBusy(true)
    try {
      await workerFetch(`/orders/${order.id}/delivery/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, otp }),
      })
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      setMsg('Delivered!')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (!order) {
    return <p className="p-4 text-sm">{msg ?? 'Loading…'}</p>
  }

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm text-primary underline">
        ← Dashboard
      </Link>
      <h1 className="text-lg font-semibold">{order.orderItems[0]?.title ?? 'Order'}</h1>
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      {isPickup && order.status === 'PICKUP_ASSIGNED' ? (
        <div className="space-y-3">
          <p className="text-sm">Seller: {order.seller.companyName}</p>
          <a
            className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 text-white"
            href={`tel:${order.pickupLocation?.contactPhone ?? ''}`}
          >
            Call seller
          </a>
          <Button className="min-h-14 w-full" disabled={busy} onClick={() => void pickupInit()}>
            I&apos;ve arrived — send OTP to seller
          </Button>
          {sessionId ? (
            <>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="min-h-12 w-full text-sm"
                onChange={(e) => void pickupScan(e.target.files?.[0] ?? null, '')}
              />
              <input
                className="min-h-12 w-full rounded border px-2"
                placeholder="Or paste QR / tracking"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) void pickupScan(null, v)
                }}
              />
              <input
                className="min-h-12 w-full rounded border px-2 text-center text-xl tracking-widest"
                placeholder="Seller OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button className="min-h-14 w-full" disabled={busy} onClick={() => void pickupVerify()}>
                Confirm pickup
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {isDelivery &&
      (order.status === 'DELIVERY_ASSIGNED' || order.status === 'AT_DESTINATION_HUB') ? (
        <div className="space-y-3">
          <p className="text-sm">Customer: {order.customer?.fullName}</p>
          <a
            className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 text-white"
            href={`tel:${order.customer?.phone ?? ''}`}
          >
            Call customer
          </a>
          <Button className="min-h-14 w-full" disabled={busy} onClick={() => void deliveryInit()}>
            Start delivery — send OTP
          </Button>
          {sessionId ? (
            <>
              <input
                className="min-h-12 w-full rounded border px-2 text-center text-xl"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button className="min-h-14 w-full" disabled={busy} onClick={() => void deliveryVerify()}>
                Confirm delivery
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {!isPickup && !isDelivery ? (
        <p className="text-sm text-muted-foreground">You are not assigned to this order.</p>
      ) : null}
    </div>
  )
}
