'use client'

import { DailyOrdersChart, OrdersByStatusChart } from '../../../components/admin-charts'
import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Network-wide aggregates from the last {analytics.data?.data.windowDays ?? 30} days.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Created in rolling window</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <OrdersByStatusChart data={statusChartData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New orders per day</CardTitle>
            <CardDescription>Last 7 calendar days</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <DailyOrdersChart data={analytics.data?.data.ordersCreatedByDay ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
