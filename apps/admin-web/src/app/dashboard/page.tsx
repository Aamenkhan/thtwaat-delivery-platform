'use client'

import { apiFetch, logoutRequest } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

type Row = {
  publicId: string
  status: string
  seller: { companyName: string | null }
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
}

export default function AdminDashboardHome() {
  const router = useRouter()
  const [live, setLive] = useState<string | null>(null)

  const logistics = useQuery({
    queryKey: ['admin', 'logistics'],
    queryFn: () =>
      apiFetch<{ data: Record<string, unknown> }>('/v1/admin/logistics/summary'),
  })

  const shipments = useQuery({
    queryKey: ['admin', 'shipments'],
    queryFn: () =>
      apiFetch<{ data: { orders: Row[]; total: number } }>(
        '/v1/admin/shipments?limit=12&offset=0'
      ),
  })

  const first = shipments.data?.data.orders[0]?.publicId
  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!first) return
    const off = subscribeOrderStatus(socket, first, {
      onStatus: () => setLive(`Live: order ${first} status changed`),
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [first, socket])

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations home</h1>
          <p className="text-sm text-muted-foreground">
            Logistics summary, recent shipments, and Socket.IO on the first row.
          </p>
        </div>
        <Button variant="outline" type="button" onClick={() => void logout()}>
          Log out
        </Button>
      </header>
      {live ? <p className="text-sm text-primary">{live}</p> : null}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Logistics summary</h2>
        {logistics.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <pre className="mt-3 max-h-64 overflow-auto text-xs">
            {JSON.stringify(logistics.data?.data, null, 2)}
          </pre>
        )}
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent shipments</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/live">Live view</Link>
          </Button>
        </div>
        <ul className="mt-3 divide-y text-sm">
          {(shipments.data?.data.orders ?? []).map((o) => (
            <li key={o.publicId} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-mono text-xs">{o.publicId}</span>
              <span className="text-muted-foreground">
                {o.shipment?.trackingNumber ?? o.shipment?.trackingPublicId ?? '—'}
              </span>
              <span>{o.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
