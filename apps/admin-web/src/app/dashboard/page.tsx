'use client'

import { DailyOrdersChart, HubVolumeChart, OrdersByStatusChart } from '../../components/admin-charts'
import { formatInrFromMinorUnits } from '../../lib/format'
import { apiFetch } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  KpiCard,
  PageHeader,
} from '@repo/ui'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CreditCard,
  Package,
  TrendingDown,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
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
        setLive(`Live update: ${first}`)
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

  const s = ops.data?.data.summary

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ── */}
      <PageHeader
        badge="Live"
        title="Operations Dashboard"
        description="Network logistics, shipments & realtime analytics."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/analytics">
              <BarChart3 className="mr-2 size-4" />
              Full analytics
            </Link>
          </Button>
        }
      />

      {/* ── Live update pill ── */}
      {live ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-4 py-2.5 text-sm text-primary">
          <span className="size-2 rounded-full bg-primary animate-pulse-dot" />
          {live}
        </div>
      ) : null}

      {/* ── Primary KPIs ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Network Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Live Shipments"
            value={logistics.data?.data.liveShipmentCount ?? '—'}
            hint="In transit right now"
            icon={Truck}
            color="primary"
          />
          <KpiCard
            label="COD in Pipeline"
            value={logistics.data ? formatInrFromMinorUnits(logistics.data.data.codPendingPaise) : '—'}
            hint="Open COD orders"
            icon={CreditCard}
            color="success"
          />
          <KpiCard
            label="Failed (24h)"
            value={logistics.data?.data.failedDeliveriesLast24h ?? '—'}
            hint="Cancelled deliveries"
            icon={TrendingDown}
            color="destructive"
          />
          <KpiCard
            label="Open NDR"
            value={s?.openNdrCases ?? '—'}
            hint="Network-wide"
            icon={AlertTriangle}
            color="warning"
          />
        </div>
      </section>

      {/* ── Ops KPIs ── */}
      {s ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Operations Health
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Active (Ops)"
              value={s.activeShipmentsNetworkWide}
              hint="Network-wide cross-check"
              icon={Activity}
              color="primary"
            />
            <KpiCard
              label="Delivery Exceptions"
              value={s.openDeliveryExceptions}
              hint="Open cases"
              icon={Zap}
              color="warning"
            />
            <KpiCard
              label="Pending Payouts"
              value={s.pendingSellerPayouts}
              hint="Seller settlements"
              icon={CreditCard}
              color="success"
            />
            <KpiCard
              label="Unsettled Worker Pay"
              value={s.unsettledWorkerEarnings}
              hint="Rows pending"
              icon={Users}
              color="primary"
            />
            <KpiCard
              label="Failed Jobs (24h)"
              value={s.integrationJobsFailedLast24h}
              hint="Integration failures"
              icon={AlertTriangle}
              color="destructive"
            />
          </div>
        </section>
      ) : null}

      {/* ── Charts ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Analytics
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
              <CardDescription>Last 30 days · network-wide</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.isLoading ? (
                <div className="shimmer h-[270px] rounded-xl" />
              ) : (
                <OrdersByStatusChart data={statusChartData} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Orders Created per Day</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.isLoading ? (
                <div className="shimmer h-[230px] rounded-xl" />
              ) : (
                <DailyOrdersChart data={analytics.data?.data.ordersCreatedByDay ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Hub volume ── */}
      <Card>
        <CardHeader>
          <CardTitle>Destination Hub Volume</CardTitle>
          <CardDescription>Orders grouped by destination hub</CardDescription>
        </CardHeader>
        <CardContent>
          {logistics.isLoading ? (
            <div className="shimmer h-[240px] rounded-xl" />
          ) : (
            <HubVolumeChart data={destHubChart} labelKey="Orders" />
          )}
        </CardContent>
      </Card>

      {/* ── Recent shipments table ── */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Recent Shipments</CardTitle>
            <CardDescription>Latest updates across sellers</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/shipments">
              <Package className="mr-2 size-4" />
              View all
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {shipments.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="shimmer h-10 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="pb-3 pr-4 font-semibold uppercase tracking-wider">Public ID</th>
                    <th className="pb-3 pr-4 font-semibold uppercase tracking-wider">Tracking</th>
                    <th className="pb-3 pr-4 font-semibold uppercase tracking-wider">Seller</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(shipments.data?.data.orders ?? []).map((o) => (
                    <tr key={o.publicId} className="group align-middle transition-colors hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs">
                        <Link
                          className="text-primary underline-offset-2 hover:underline"
                          href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}
                        >
                          {o.publicId}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {o.shipment?.trackingNumber ?? o.shipment?.trackingPublicId ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-sm">{o.seller.companyName ?? '—'}</td>
                      <td className="py-3">
                        <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
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
