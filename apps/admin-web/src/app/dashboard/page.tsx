'use client'

import { DailyOrdersChart, HubVolumeChart, OrdersByStatusChart } from '../../components/admin-charts'
import { formatInrFromMinorUnits } from '../../lib/format'
import { apiFetch, logoutRequest } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type LogisticsSummary = {
  liveShipmentCount: number
  failedDeliveriesLast24h: number
  codPendingPaise: number
  cityWise: { hub: { city: string | null; code: string | null } | null; orders: number }[]
  hubPerformance: { hub: { city: string | null; code: string | null } | null; outboundOrders: number }[]
}

type OpsSummary = {
  activeShipmentsNetworkWide: number
  openNdrCases: number
  openDeliveryExceptions: number
  pendingSellerPayouts: number
  unsettledWorkerEarnings: number
  integrationJobsFailedLast24h: number
}

type ShipmentRow = {
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
    queryFn: () => apiFetch<{ data: LogisticsSummary }>('/v1/admin/logistics/summary'),
  })

  const ops = useQuery({
    queryKey: ['admin', 'ops'],
    queryFn: () => apiFetch<{ data: { summary: OpsSummary } }>('/v1/admin/ops/summary'),
  })

  const analytics = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () =>
      apiFetch<{
        data: {
          ordersByStatus: Record<string, number>
          ordersCreatedByDay: { date: string; count: number }[]
        }
      }>('/v1/admin/logistics/analytics'),
  })

  const shipments = useQuery({
    queryKey: ['admin', 'shipments', 'home'],
    queryFn: () =>
      apiFetch<{ data: { orders: ShipmentRow[]; total: number } }>(
        '/v1/admin/shipments?limit=10&offset=0'
      ),
  })

  const first = shipments.data?.data.orders[0]?.publicId
  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!first) return
    const off = subscribeOrderStatus(socket, first, {
      onStatus: () => {
        setLive(`Live: ${first} updated`)
        void logistics.refetch()
        void shipments.refetch()
      },
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [first, socket, logistics, shipments])

  const statusChartData = useMemo(() => {
    const m = analytics.data?.data.ordersByStatus ?? {}
    return Object.entries(m).map(([name, count]) => ({
      name: name.replace(/_/g, ' '),
      count,
    }))
  }, [analytics.data])

  const destHubChart = useMemo(() => {
    const rows = logistics.data?.data.cityWise ?? []
    return rows.map((r) => ({
      label: r.hub?.city ?? r.hub?.code ?? 'Hub',
      orders: r.orders,
    }))
  }, [logistics.data])

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
  }

  const s = ops.data?.data.summary

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Network logistics, shipments, analytics, and realtime updates (first recent order).
          </p>
        </div>
        <Button variant="outline" type="button" onClick={() => void logout()}>
          Log out
        </Button>
      </header>

      {live ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{live}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Live shipments"
          value={logistics.data?.data.liveShipmentCount ?? '—'}
          hint="Not delivered / cancelled"
        />
        <StatCard
          title="COD in pipeline"
          value={
            logistics.data ? formatInrFromMinorUnits(logistics.data.data.codPendingPaise) : '—'
          }
          hint="Open COD orders"
        />
        <StatCard title="Failed (24h)" value={logistics.data?.data.failedDeliveriesLast24h ?? '—'} hint="Cancelled" />
        <StatCard title="Open NDR" value={s?.openNdrCases ?? '—'} hint="Network-wide" />
      </section>

      {s ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Active (ops)" value={s.activeShipmentsNetworkWide} hint="Cross-check" />
          <StatCard title="Delivery exceptions" value={s.openDeliveryExceptions} hint="OPEN" />
          <StatCard title="Pending payouts" value={s.pendingSellerPayouts} hint="Sellers" />
          <StatCard title="Unsettled worker pay" value={s.unsettledWorkerEarnings} hint="Rows" />
          <StatCard title="Failed jobs (24h)" value={s.integrationJobsFailedLast24h} hint="Integrations" />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Last 30 days, network-wide</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : (
              <OrdersByStatusChart data={statusChartData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders created per day</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : (
              <DailyOrdersChart data={analytics.data?.data.ordersCreatedByDay ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Destination hub volume</CardTitle>
          <CardDescription>Orders grouped by destination hub</CardDescription>
        </CardHeader>
        <CardContent>
          {logistics.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <HubVolumeChart data={destHubChart} labelKey="Orders" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Recent shipments</CardTitle>
            <CardDescription>Latest updates across sellers</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/shipments">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {shipments.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Public ID</th>
                    <th className="pb-2 pr-3 font-medium">Tracking</th>
                    <th className="pb-2 pr-3 font-medium">Seller</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(shipments.data?.data.orders ?? []).map((o) => (
                    <tr key={o.publicId} className="align-top">
                      <td className="py-2 pr-3 font-mono text-xs">
                        <Link
                          className="text-primary underline-offset-2 hover:underline"
                          href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}
                        >
                          {o.publicId}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {o.shipment?.trackingNumber ?? o.shipment?.trackingPublicId ?? '—'}
                      </td>
                      <td className="py-2 pr-3">{o.seller.companyName ?? '—'}</td>
                      <td className="py-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {o.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, hint }: { title: string; value: ReactNode; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
