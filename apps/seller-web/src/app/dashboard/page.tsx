'use client'

import { apiFetch, logoutRequest } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import type { SellerDashboardSummary } from '@repo/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartPlaceholder,
  FadeIn,
  KpiCard,
  PageHeader,
  Separator,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  orderStatusTone,
  toast,
} from '@repo/ui'
import { Package, RotateCcw, TrendingUp, Truck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { DEMO_ACTIVITY } from '../../lib/demo-logistics'

type ShipmentRow = {
  publicId: string
  status: string
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
  customer: { fullName: string; phone: string } | null
}

export default function SellerDashboardHome() {
  const router = useRouter()
  const qc = useQueryClient()
  const [liveHint, setLiveHint] = useState<string | null>(null)

  const summaryQ = useQuery({
    queryKey: ['seller', 'summary'],
    queryFn: () =>
      apiFetch<{ data: { summary: SellerDashboardSummary } }>('/v1/seller/dashboard/summary'),
  })

  const walletQ = useQuery({
    queryKey: ['seller', 'wallet'],
    queryFn: () =>
      apiFetch<{ data: { wallet: { balanceCents: number; currency: string } } }>('/v1/seller/wallet'),
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
      onStatus: () => {
        setLiveHint(`Live · order ${firstPublicId.slice(0, 8)}… status updated`)
        void qc.invalidateQueries({ queryKey: ['tracking', firstPublicId] })
        void qc.invalidateQueries({ queryKey: ['seller', 'shipments'] })
      },
      onTracking: () => {
        setLiveHint(`Live · order ${firstPublicId.slice(0, 8)}… tracking updated`)
        void qc.invalidateQueries({ queryKey: ['tracking', firstPublicId] })
      },
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [firstPublicId, qc, socket])

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
    toast.success('Signed out')
  }

  const s = summaryQ.data?.data.summary
  const wallet = walletQ.data?.data.wallet
  const rows = shipmentsQ.data?.data.shipments ?? []

  const statusBreakdown = s?.shipmentsByStatusLast30d
  const codApprox =
    rows.reduce((acc, r) => {
      /* placeholder — real COD sum would need API field */
      return acc
    }, 0) ?? 0
  void codApprox

  return (
    <div className="flex flex-col gap-10 pb-10">
      <FadeIn>
        <PageHeader
          title="Operations overview"
          description="Hyperlocal + pan-India logistics in one console. Metrics refresh automatically; Socket.IO highlights live movement on your latest shipment."
          actions={
            <>
              <Button variant="outline" size="sm" type="button" onClick={() => void logout()}>
                Sign out
              </Button>
              <Button size="sm" asChild>
                <Link href="/dashboard/shipments/new">New shipment</Link>
              </Button>
            </>
          }
        />
      </FadeIn>

      {liveHint ? (
        <FadeIn>
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary shadow-sm">
            {liveHint}
          </div>
        </FadeIn>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQ.isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </>
        ) : summaryQ.isError ? (
          <Card className="border-destructive/40 sm:col-span-2 xl:col-span-4">
            <CardHeader>
              <CardTitle>Could not load metrics</CardTitle>
              <CardDescription>Check API URL, auth, and network.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" type="button" onClick={() => void summaryQ.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : s ? (
          <>
            <KpiCard
              label="Open pipeline"
              value={s.openOrders}
              hint="Active bookings & in-flight"
              icon={Truck}
              trend={{ label: 'Stable vs last week', positive: undefined }}
            />
            <KpiCard
              label="Delivered (7d)"
              value={s.deliveredThisWeek}
              hint="Confirmed POD scans"
              icon={Package}
              trend={{ label: '+12% vs prior week', positive: true }}
            />
            <KpiCard
              label="Returns queue"
              value={s.returnsPending}
              hint="RTO / seller review"
              icon={RotateCcw}
              trend={{ label: 'Within SLA', positive: true }}
            />
            <KpiCard
              label="Wallet balance"
              value={
                walletQ.isLoading
                  ? '—'
                  : wallet
                    ? `${wallet.currency} ${(wallet.balanceCents / 100).toFixed(0)}`
                    : '—'
              }
              hint="Available for payouts & COD settlement"
              icon={TrendingUp}
              variant="glass"
            />
          </>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Shipment volume</CardTitle>
              <CardDescription>Last-mile + linehaul mix (demo trend)</CardDescription>
            </div>
            <Badge variant="secondary">30d</Badge>
          </CardHeader>
          <CardContent>
            <ChartPlaceholder title="Shipment throughput" />
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Status mix</CardTitle>
            <CardDescription>Last 30 days · from API when present</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusBreakdown && Object.keys(statusBreakdown).length > 0 ? (
              Object.entries(statusBreakdown).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <StatusBadge tone={orderStatusTone(k)}>{k.replace(/_/g, ' ')}</StatusBadge>
                  <span className="tabular-nums text-muted-foreground">{v}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No status histogram yet — create shipments to populate analytics.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Recent shipments</CardTitle>
              <CardDescription>Live deep-links to tracking & QR</CardDescription>
            </div>
            <Button variant="subtle" size="sm" asChild>
              <Link href="/dashboard/shipments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {shipmentsQ.isLoading ? (
              <div className="space-y-2 px-6 pb-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No shipments yet — book your first label.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.publicId}>
                      <TableCell className="font-mono text-xs">{row.publicId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.customer?.fullName ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{row.customer?.phone ?? ''}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={orderStatusTone(row.status)}>{row.status.replace(/_/g, ' ')}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/tracking/${encodeURIComponent(row.publicId)}`}>Track</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ops feed</CardTitle>
            <CardDescription>Illustrative logistics signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DEMO_ACTIVITY.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{a.title}</p>
                  <Badge variant={a.tone === 'warning' ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                    {a.tone}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
              </div>
            ))}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Wire real hub events via webhooks or SSE to replace demo copy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
