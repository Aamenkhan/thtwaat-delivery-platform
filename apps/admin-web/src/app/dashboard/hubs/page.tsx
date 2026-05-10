'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import {
  DataTable,
  EmptyStateBox,
  HubTypeBadge,
  MapPlaceholder,
  SectionHeader,
  StatBanner,
  type ColDef,
} from '../../../components/ui-kit'
import { Building2, MapPin } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

type Hub = {
  id: string
  name: string
  city: string | null
  state: string | null
  code: string | null
  hubType: string
  latitude: number
  longitude: number
}

export default function HubsPage() {
  const q = useQuery({
    queryKey: ['admin', 'hubs'],
    queryFn: () => apiFetch<{ data: { hubs: Hub[] } }>('/v1/hubs'),
  })

  const hubs = q.data?.data.hubs ?? []

  const stats = useMemo(() => {
    const byType = hubs.reduce<Record<string, number>>((acc, h) => {
      acc[h.hubType] = (acc[h.hubType] ?? 0) + 1
      return acc
    }, {})
    return {
      total: hubs.length,
      sort: byType['SORT_CENTER'] ?? 0,
      delivery: byType['DELIVERY_HUB'] ?? 0,
      collection: byType['COLLECTION_HUB'] ?? 0,
    }
  }, [hubs])

  const columns: ColDef<Hub>[] = [
    {
      key: 'name',
      header: 'Hub',
      render: (h) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="size-4 text-primary" />
          </span>
          <div>
            <p className="font-semibold leading-tight">{h.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{h.code ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (h) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          {[h.city, h.state].filter(Boolean).join(', ') || '—'}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (h) => <HubTypeBadge type={h.hubType} />,
    },
    {
      key: 'coords',
      header: 'Coordinates',
      render: (h) => (
        <span className="font-mono text-xs text-muted-foreground">
          {h.latitude.toFixed(3)}, {h.longitude.toFixed(3)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Infrastructure"
        title="Hub Network"
        description="Sort centers and last-mile delivery nodes across the network"
      />

      {/* ── Stats ── */}
      <StatBanner
        items={[
          { label: 'Total Hubs', value: stats.total, sub: 'All network nodes' },
          { label: 'Sort Centers', value: stats.sort, sub: 'Primary sort hubs', color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Delivery Hubs', value: stats.delivery, sub: 'Last-mile nodes', color: 'text-cyan-600 dark:text-cyan-400' },
          { label: 'Collection Hubs', value: stats.collection, sub: 'Pickup points', color: 'text-teal-600 dark:text-teal-400' },
        ]}
      />

      {/* ── Map ── */}
      <MapPlaceholder height={340} label="Hub Network Map" />

      {/* ── Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            All Hubs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <EmptyStateBox
              icon={<Building2 className="size-8 text-red-400/50" />}
              title="Failed to load hubs"
              description="Check API connectivity."
            />
          ) : (
            <DataTable
              columns={columns}
              data={hubs}
              minWidth="min-w-[640px]"
              isLoading={q.isLoading}
              emptyMessage="No hubs found in the network."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
