'use client'

import { apiFetch, logoutRequest } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import type { SellerDashboardSummary } from '@repo/types'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

type ShipmentRow = {
  publicId: string
  status: string
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
  customer: { fullName: string; phone: string } | null
}

export default function SellerDashboardHome() {
  const router = useRouter()
  const [liveHint, setLiveHint] = useState<string | null>(null)

  const summaryQ = useQuery({
    queryKey: ['seller', 'summary'],
    queryFn: () =>
      apiFetch<{ data: { summary: SellerDashboardSummary } }>(
        '/v1/seller/dashboard/summary'
      ),
  })

  const shipmentsQ = useQuery({
    queryKey: ['seller', 'shipments', 1],
    queryFn: () =>
      apiFetch<{
        data: { shipments: ShipmentRow[] }
      }>('/v1/seller/shipments?limit=8&page=1'),
  })

  const firstPublicId = shipmentsQ.data?.data?.shipments[0]?.publicId

  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!firstPublicId) return
    const off = subscribeOrderStatus(socket, firstPublicId, {
      onStatus: () => setLiveHint(`Order ${firstPublicId} status updated (live)`),
      onTracking: () => setLiveHint(`Order ${firstPublicId} tracking updated (live)`),
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [firstPublicId, socket])

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
  }

  const s = summaryQ.data?.data.summary

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            React Query + Socket.IO (subscribes to first listed order for demo).
          </p>
        </div>
        <Button variant="outline" type="button" onClick={() => void logout()}>
          Log out
        </Button>
      </header>

      {liveHint ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {liveHint}
        </p>
      ) : null}

      {summaryQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading summary…</p>
      ) : summaryQ.isError ? (
        <p className="text-sm text-destructive">Could not load dashboard (check API & login).</p>
      ) : s ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Open orders" value={s.openOrders} />
          <Metric label="Delivered this week" value={s.deliveredThisWeek} />
          <Metric label="Returns pending" value={s.returnsPending} />
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent shipments</h2>
          <Button asChild size="sm">
            <Link href="/dashboard/shipments/new">Create shipment</Link>
          </Button>
        </div>
        {shipmentsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y text-sm">
            {(shipmentsQ.data?.data.shipments ?? []).map((row) => (
              <li key={row.publicId} className="flex flex-wrap justify-between gap-2 py-3">
                <div>
                  <p className="font-mono text-xs">{row.publicId}</p>
                  <p className="text-muted-foreground">
                    {row.shipment?.trackingNumber ?? row.shipment?.trackingPublicId ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p>{row.status}</p>
                  <Link
                    className="text-xs text-primary underline"
                    href={`/dashboard/tracking/${row.publicId}`}
                  >
                    Track live
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
