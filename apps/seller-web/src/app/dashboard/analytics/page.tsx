'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery } from '@tanstack/react-query'

export default function AnalyticsPage() {
  const q = useQuery({
    queryKey: ['seller', 'analytics'],
    queryFn: () =>
      apiFetch<{
        data: {
          shipmentsByStatusLast30d?: Record<string, number>
          openOrders: number
          deliveredThisWeek: number
        }
      }>('/v1/seller/analytics/shipments'),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load analytics.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label="Open orders" value={q.data?.data.openOrders ?? 0} />
          <Tile label="Delivered this week" value={q.data?.data.deliveredThisWeek ?? 0} />
          <Tile
            label="Statuses (30d)"
            value={Object.keys(q.data?.data.shipmentsByStatusLast30d ?? {}).length}
          />
        </div>
      )}
      {q.data?.data.shipmentsByStatusLast30d ? (
        <pre className="rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(q.data.data.shipmentsByStatusLast30d, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
