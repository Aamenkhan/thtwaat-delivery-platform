'use client'

/**
 * Worker order OTP micro-flow (matches API worker-gig-orders.service):
 *
 * 1) Pickup: PICKUP_ASSIGNED → POST pickup/init (OTP → seller phone) → POST pickup/scan (QR+photo)
 *    → PICKUP_SCANNED → POST pickup/verify-otp (seller OTP) → SELLER_CONFIRMED
 * 2) Hub drop: SELLER_CONFIRMED → POST hub-drop/init (OTP → hub manager) → POST hub-drop/verify-otp
 *    (hub staff Worker id + OTP) → AT_SOURCE_HUB
 * 3) Delivery: DELIVERY_ASSIGNED | AT_DESTINATION_HUB → POST delivery/init (OTP → customer)
 *    → OUT_FOR_DELIVERY → POST delivery/verify-otp → DELIVERED
 */

import confetti from 'canvas-confetti'
import { Button, Skeleton } from '@repo/ui'
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
  sourceHub: { id: string; name: string; latitude: number; longitude: number } | null
}

function sessKey(orderId: string, phase: 'pickup' | 'hub' | 'delivery') {
  return `thtwaat_worker_otp_${phase}_${orderId}`
}

export default function OrderFlowPage() {
  const params = useParams()
  const orderId = String(params.orderId ?? '')
  const [wid, setWid] = useState<string | null | undefined>(undefined)
  const [order, setOrder] = useState<Order | null>(null)
  const [pickupSessionId, setPickupSessionId] = useState('')
  const [sellerOtp, setSellerOtp] = useState('')
  const [hubSessionId, setHubSessionId] = useState('')
  const [hubOtp, setHubOtp] = useState('')
  const [hubStaffId, setHubStaffId] = useState('')
  const [deliverySessionId, setDeliverySessionId] = useState('')
  const [customerOtp, setCustomerOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setWid(readWorkerId())
  }, [])

  useEffect(() => {
    if (!orderId || !wid) return
    setPickupSessionId(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessKey(orderId, 'pickup')) ?? '' : '')
    setHubSessionId(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessKey(orderId, 'hub')) ?? '' : '')
    setDeliverySessionId(
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessKey(orderId, 'delivery')) ?? '' : ''
    )
    void (async () => {
      try {
        const o = await workerFetch<Order>(`/orders/${orderId}`)
        setOrder(o)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      }
    })()
  }, [orderId, wid])

  const isPickup = order?.pickupWorkerId === wid
  const isDelivery = order?.assignedWorkerId === wid

  function clearNotice() {
    setError(null)
    setInfo(null)
  }

  async function reloadOrder() {
    if (!order) return
    const o = await workerFetch<Order>(`/orders/${order.id}`)
    setOrder(o)
  }

  async function pickupInit() {
    if (!order) return
    setBusy(true)
    clearNotice()
    try {
      const r = await workerFetch<{ sessionId: string }>(
        `/orders/${order.id}/pickup/init`,
        { method: 'POST' }
      )
      setPickupSessionId(r.sessionId)
      sessionStorage.setItem(sessKey(order.id, 'pickup'), r.sessionId)
      setInfo('OTP sent to seller (check server logs in dev). Scan parcel QR next.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function pickupScan(file: File | null, manualQr: string) {
    if (!order || !wid) return
    setBusy(true)
    clearNotice()
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
          setError('Supabase env missing — set NEXT_PUBLIC_SUPABASE_* vars.')
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
      await reloadOrder()
      setInfo('Scanned. Ask seller for OTP, then confirm below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  async function pickupVerify() {
    if (!order || !pickupSessionId) return
    setBusy(true)
    clearNotice()
    try {
      await workerFetch(`/orders/${order.id}/pickup/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: pickupSessionId, otp: sellerOtp }),
      })
      sessionStorage.removeItem(sessKey(order.id, 'pickup'))
      setPickupSessionId('')
      setSellerOtp('')
      await reloadOrder()
      setInfo('Seller confirmed. Go to hub for drop OTP.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OTP failed')
    } finally {
      setBusy(false)
    }
  }

  async function hubDropInit() {
    if (!order?.sourceHub?.id) {
      setError('Source hub missing on order — cannot start hub drop.')
      return
    }
    setBusy(true)
    clearNotice()
    try {
      const r = await workerFetch<{ sessionId: string }>(`/orders/${order.id}/hub-drop/init`, {
        method: 'POST',
        body: JSON.stringify({
          hubId: order.sourceHub.id,
          lat: order.sourceHub.latitude,
          lng: order.sourceHub.longitude,
        }),
      })
      setHubSessionId(r.sessionId)
      sessionStorage.setItem(sessKey(order.id, 'hub'), r.sessionId)
      setInfo('OTP sent to hub manager (see logs in dev). Enter hub staff Worker ID + OTP.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hub OTP init failed')
    } finally {
      setBusy(false)
    }
  }

  async function hubDropVerify() {
    if (!order || !hubSessionId) return
    setBusy(true)
    clearNotice()
    try {
      await workerFetch(`/orders/${order.id}/hub-drop/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: hubSessionId,
          otp: hubOtp,
          hubStaffId: hubStaffId.trim(),
        }),
      })
      sessionStorage.removeItem(sessKey(order.id, 'hub'))
      setHubSessionId('')
      setHubOtp('')
      setHubStaffId('')
      await reloadOrder()
      setInfo('Parcel accepted at hub.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hub verify failed')
    } finally {
      setBusy(false)
    }
  }

  async function deliveryInit() {
    if (!order) return
    setBusy(true)
    clearNotice()
    try {
      const r = await workerFetch<{ sessionId: string }>(
        `/orders/${order.id}/delivery/init`,
        { method: 'POST', body: JSON.stringify({ lat: 0, lng: 0 }) }
      )
      setDeliverySessionId(r.sessionId)
      sessionStorage.setItem(sessKey(order.id, 'delivery'), r.sessionId)
      setInfo('OTP sent to customer. Enter code to complete delivery.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function deliveryVerify() {
    if (!order || !deliverySessionId) return
    setBusy(true)
    clearNotice()
    try {
      await workerFetch(`/orders/${order.id}/delivery/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: deliverySessionId, otp: customerOtp }),
      })
      sessionStorage.removeItem(sessKey(order.id, 'delivery'))
      setDeliverySessionId('')
      setCustomerOtp('')
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      setInfo('Delivered!')
      await reloadOrder()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (wid === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (!wid) {
    return (
      <p className="p-4 text-sm">
        Login करें।{' '}
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </p>
    )
  }

  if (!order) {
    return <p className="p-4 text-sm">{error ?? 'Loading…'}</p>
  }

  const showPickupBlock =
    isPickup && (order.status === 'PICKUP_ASSIGNED' || order.status === 'PICKUP_SCANNED')
  const showHubDropBlock = isPickup && order.status === 'SELLER_CONFIRMED'
  const showDeliveryBlock =
    isDelivery &&
    (order.status === 'DELIVERY_ASSIGNED' ||
      order.status === 'AT_DESTINATION_HUB' ||
      order.status === 'OUT_FOR_DELIVERY')

  return (
    <div className="space-y-4 p-4">
      <Link href="/dashboard" className="text-sm text-primary underline">
        ← Dashboard
      </Link>
      <h1 className="text-lg font-semibold">{order.orderItems[0]?.title ?? 'Order'}</h1>
      <p className="text-xs text-muted-foreground">Status: {order.status}</p>
      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {info ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}</p> : null}

      {showPickupBlock ? (
        <section className="space-y-3 rounded-xl border p-3">
          <h2 className="text-sm font-semibold">Pickup (seller OTP)</h2>
          <p className="text-xs text-muted-foreground">
            ① Send OTP → ② Scan QR / photo → ③ Seller reads OTP → you confirm.
          </p>
          <p className="text-sm">Seller: {order.seller.companyName}</p>
          <a
            className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 text-white"
            href={`tel:${order.pickupLocation?.contactPhone ?? ''}`}
          >
            Call seller
          </a>
          {order.status === 'PICKUP_ASSIGNED' ? (
            <Button className="min-h-14 w-full" disabled={busy} onClick={() => void pickupInit()}>
              I&apos;ve arrived — send OTP to seller
            </Button>
          ) : null}
          {pickupSessionId && (order.status === 'PICKUP_ASSIGNED' || order.status === 'PICKUP_SCANNED') ? (
            <>
              {order.status === 'PICKUP_ASSIGNED' ? (
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
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Scanned — enter seller OTP only.</p>
              )}
              <input
                className="min-h-12 w-full rounded border px-2 text-center text-xl tracking-widest"
                placeholder="Seller OTP (6 digits)"
                value={sellerOtp}
                onChange={(e) => setSellerOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button className="min-h-14 w-full" disabled={busy || sellerOtp.length < 4} onClick={() => void pickupVerify()}>
                Confirm pickup (verify seller OTP)
              </Button>
            </>
          ) : null}
        </section>
      ) : null}

      {showHubDropBlock ? (
        <section className="space-y-3 rounded-xl border p-3">
          <h2 className="text-sm font-semibold">Hub drop (manager OTP)</h2>
          <p className="text-xs text-muted-foreground">
            Hub: {order.sourceHub?.name ?? '—'}. Manager gets OTP; a hub staff Worker must confirm with their Worker
            ID.
          </p>
          {!hubSessionId ? (
            <Button className="min-h-14 w-full" disabled={busy || !order.sourceHub?.id} onClick={() => void hubDropInit()}>
              Send OTP to hub manager
            </Button>
          ) : (
            <>
              <input
                className="min-h-12 w-full rounded border px-2 font-mono text-sm"
                placeholder="Hub staff Worker ID (cuid)"
                value={hubStaffId}
                onChange={(e) => setHubStaffId(e.target.value.trim())}
              />
              <input
                className="min-h-12 w-full rounded border px-2 text-center text-xl tracking-widest"
                placeholder="Hub OTP"
                value={hubOtp}
                onChange={(e) => setHubOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button
                className="min-h-14 w-full"
                disabled={busy || hubOtp.length < 4 || hubStaffId.length < 8}
                onClick={() => void hubDropVerify()}
              >
                Verify hub drop
              </Button>
            </>
          )}
        </section>
      ) : null}

      {showDeliveryBlock ? (
        <section className="space-y-3 rounded-xl border p-3">
          <h2 className="text-sm font-semibold">Delivery (customer OTP)</h2>
          <p className="text-sm">Customer: {order.customer?.fullName}</p>
          <a
            className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 text-white"
            href={`tel:${order.customer?.phone ?? ''}`}
          >
            Call customer
          </a>
          {order.status !== 'OUT_FOR_DELIVERY' ? (
            <Button className="min-h-14 w-full" disabled={busy} onClick={() => void deliveryInit()}>
              Start delivery — send OTP to customer
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Out for delivery — enter customer OTP.</p>
          )}
          {deliverySessionId ? (
            <>
              <input
                className="min-h-12 w-full rounded border px-2 text-center text-xl tracking-widest"
                placeholder="Customer OTP"
                value={customerOtp}
                onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button
                className="min-h-14 w-full"
                disabled={busy || customerOtp.length < 4}
                onClick={() => void deliveryVerify()}
              >
                Confirm delivery
              </Button>
            </>
          ) : order.status === 'OUT_FOR_DELIVERY' ? (
            <p className="text-xs text-muted-foreground">
              OTP session was opened on this device when you tapped &quot;Start delivery&quot;. If you refreshed and lost
              it, open this order again from the dashboard on the same browser session, or contact dispatch — a new OTP
              session requires starting before OUT_FOR_DELIVERY.
            </p>
          ) : null}
        </section>
      ) : null}

      {!isPickup && !isDelivery ? (
        <p className="text-sm text-muted-foreground">You are not assigned to this order.</p>
      ) : null}
    </div>
  )
}
