'use client'

import { Button, Skeleton } from '@repo/ui'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { workerFetch } from '../../lib/worker-api'
import { readWorkerId } from '../../lib/worker-session'
import { disconnectWorkerSocket, getWorkerSocket } from '../../lib/worker-socket'

type Profile = {
  id: string
  displayName: string
  photoUrl: string | null
  isOnline: boolean
  todayEarnings: number
  homeHubId: string | null
  canGoOnline?: boolean
  blockers?: string[]
}

type OrderRow = {
  id: string
  publicId: string
  status: string
  pickupWorkerId: string | null
  assignedWorkerId: string | null
  seller: { companyName: string | null }
  customer: { fullName: string } | null
  orderItems: { title: string }[]
  pickupLocation: { line1: string } | null
  deliveryLocation: { line1: string } | null
}

export default function WorkerDashboard() {
  /** `readWorkerId()` is null on SSR — avoid false "Login करें" until client has read localStorage. */
  const [id, setId] = useState<string | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [active, setActive] = useState<OrderRow[]>([])
  const [done, setDone] = useState<OrderRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  const watchRef = useRef<number | null>(null)
  const locTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setId(readWorkerId())
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      try {
        const p = await workerFetch<Profile>(`/workers/${id}/profile`)
        if (!cancelled) {
          setProfile(p)
          setOnline(Boolean(p.isOnline))
        }
        const a = await workerFetch<OrderRow[]>(`/workers/me/orders?filter=active`)
        if (!cancelled) setActive(a)
        const d = await workerFetch<OrderRow[]>(`/workers/me/orders?filter=completed_today`)
        if (!cancelled) setDone(d)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !profile?.homeHubId) return
    const s = getWorkerSocket()
    s.emit('subscribe:hub', profile.homeHubId)
    return () => {
      disconnectWorkerSocket()
    }
  }, [id, profile?.homeHubId])

  async function toggleOnline(next: boolean) {
    if (!id) return
    setErr(null)
    try {
      if (next) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          await workerFetch(`/workers/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ isOnline: true }),
          })
          setOnline(true)
          return
        }
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                await workerFetch(`/workers/${id}/status`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    isOnline: true,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  }),
                })
                setOnline(true)
                watchRef.current = navigator.geolocation.watchPosition(
                  (p) => {
                    void workerFetch(`/workers/${id}/location`, {
                      method: 'POST',
                      body: JSON.stringify({
                        lat: p.coords.latitude,
                        lng: p.coords.longitude,
                      }),
                    })
                  },
                  console.error,
                  { enableHighAccuracy: true, maximumAge: 20_000 }
                )
                locTimer.current = setInterval(() => {
                  navigator.geolocation.getCurrentPosition((p) => {
                    void workerFetch(`/workers/${id}/location`, {
                      method: 'POST',
                      body: JSON.stringify({
                        lat: p.coords.latitude,
                        lng: p.coords.longitude,
                      }),
                    })
                  })
                }, 30_000)
                resolve()
              } catch (e) {
                reject(e)
              }
            },
            reject,
            { enableHighAccuracy: true, timeout: 15_000 }
          )
        })
      } else {
        await workerFetch(`/workers/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isOnline: false }),
        })
        setOnline(false)
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
        if (locTimer.current) clearInterval(locTimer.current)
        locTimer.current = null
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Status update failed')
    }
  }

  const label = useMemo(() => {
    if (!profile) return '…'
    return profile.displayName
  }, [profile])

  if (id === undefined) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (!id) {
    return <p className="p-6 text-sm">Login करें।</p>
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div
          className="size-10 shrink-0 overflow-hidden rounded-full bg-muted bg-cover bg-center"
          style={profile?.photoUrl ? { backgroundImage: `url(${profile.photoUrl})` } : undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{online ? 'Online' : 'Offline'}</p>
        </div>
      </header>

      <button
        type="button"
        onClick={() => void toggleOnline(!online)}
        className={`flex min-h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow ${
          online
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
            : 'bg-gradient-to-r from-slate-500 to-slate-700'
        }`}
      >
        {online ? 'YOU ARE ONLINE' : 'TAP TO GO ONLINE'}
      </button>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {profile && profile.canGoOnline === false && profile.blockers?.length ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          <p className="font-semibold">Online gig अभी बंद</p>
          <p className="mt-1 text-muted-foreground">
            {profile.blockers.join(', ')} — register / profile से KYC पूरा करें, ₹999 fee, training, फिर admin
            verify का इंतज़ार।
          </p>
          <Link href="/register" className="mt-2 inline-block font-medium text-primary underline">
            Onboarding जारी रखें
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-lg font-bold">₹{profile?.todayEarnings?.toFixed(0) ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Active orders</p>
          <p className="text-lg font-bold">{active.length}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Active orders</h2>
        <div className="space-y-3">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">कोई सक्रिय ऑर्डर नहीं।</p>
          ) : (
            active.map((o) => {
              const pickup = o.pickupWorkerId === id
              const title = o.orderItems[0]?.title ?? 'Order'
              const name = pickup
                ? (o.seller.companyName ?? 'Seller')
                : (o.customer?.fullName ?? 'Customer')
              const addr =
                (pickup ? o.pickupLocation?.line1 : o.deliveryLocation?.line1) ?? '—'
              return (
                <div key={o.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{o.publicId.slice(0, 8)}…</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        pickup ? 'bg-violet-500/15 text-violet-700' : 'bg-sky-500/15 text-sky-800'
                      }`}
                    >
                      {pickup ? 'Pickup' : 'Delivery'}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{addr}</p>
                  <p className="mt-1 text-xs">{o.status}</p>
                  <Button asChild className="mt-3 min-h-12 w-full">
                    <Link href={`/orders/${o.id}`}>Take action →</Link>
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Completed today ({done.length})</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {done.map((o) => (
            <div key={o.id} className="rounded-lg border px-3 py-2">
              {o.publicId.slice(0, 8)}… · {o.status}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
