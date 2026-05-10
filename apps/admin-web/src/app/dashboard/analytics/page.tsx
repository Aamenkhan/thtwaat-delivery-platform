'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from '@repo/ui'
import {
  DailyOrdersChart,
  HubVolumeChart,
  OrdersByStatusChart,
} from '../../../components/admin-charts'
import { SectionHeader } from '../../../components/ui-kit'
import { BarChart3, CheckCircle, Package, TrendingUp, XCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export default function AdminAnalyticsPage() {
  const analytics = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () =>
      apiFetch<{
        data: {
          windowDays: number
          ordersByStatus: Record<string, number>
          ordersCreatedByDay: { date: string; count: number }[]
        }
      }>('/v1/admin/logistics/analytics'),
  })

  const statusChartData = useMemo(() => {
    const m = analytics.data?.data.ordersByStatus ?? {}
    return Object.entries(m).map(([name, count]) => ({
      name: name.replace(/_/g, ' '),
      count,
    }))
  }, [analytics.data])

  const deliveredCount = analytics.data?.data.ordersByStatus?.['DELIVERED'] ?? 0
  const cancelledCount = analytics.data?.data.ordersByStatus?.['CANCELLED'] ?? 0
  const inTransitCount = analytics.data?.data.ordersByStatus?.['IN_TRANSIT'] ?? 0
  const totalOrders = Object.values(analytics.data?.data.ordersByStatus ?? {}).reduce((a, b) => a + b, 0)

  const deliveryRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0

  const recentTrend = useMemo(() => {
    const days = analytics.data?.data.ordersCreatedByDay ?? []
    if (days.length < 2) return null
    const last = days[days.length - 1]?.count ?? 0
    const prev = days[days.length - 2]?.count ?? 0
    if (prev === 0) return null
    const pct = Math.round(((last - prev) / prev) * 100)
    return { label: `${pct > 0 ? '+' : ''}${pct}% vs yesterday`, positive: pct >= 0 }
  }, [analytics.data])

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Analytics"
        title="Network Analytics"
        description={`Network-wide aggregates for the last ${analytics.data?.data.windowDays ?? 30} days`}
      />

      {/* ── KPI Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Orders"
          value={totalOrders.toLocaleString()}
          hint={`Past ${analytics.data?.data.windowDays ?? 30} days`}
          icon={Package}
          color="primary"
        />
        <KpiCard
          label="Delivered"
          value={deliveredCount.toLocaleString()}
          hint={`${deliveryRate}% delivery rate`}
          icon={CheckCircle}
          color="success"
          trend={recentTrend ?? undefined}
        />
        <KpiCard
          label="In Transit"
          value={inTransitCount.toLocaleString()}
          hint="Currently in motion"
          icon={TrendingUp}
          color="primary"
        />
        <KpiCard
          label="Cancelled"
          value={cancelledCount.toLocaleString()}
          hint="All time in window"
          icon={XCircle}
          color="destructive"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Orders by Status
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              New Orders per Day
            </CardTitle>
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

      {/* ── Delivery rate card ── */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delivery rate</span>
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {deliveryRate}%
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-all duration-700"
                style={{ width: `${deliveryRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {deliveredCount.toLocaleString()} of {totalOrders.toLocaleString()} orders delivered
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
