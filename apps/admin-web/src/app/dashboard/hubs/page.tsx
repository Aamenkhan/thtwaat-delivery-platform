'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@repo/ui'
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
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { PincodeInput } from '../../../components/PincodeInput'
import type { PincodeLookupPayload } from '../../../hooks/usePincodeLookup'

type Hub = {
  id: string
  name: string
  city: string | null
  state: string | null
  code: string | null
  hubType: string
  latitude: number
  longitude: number
  hubProfile?: { isActive: boolean } | null
}

export default function HubsPage() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'hubs'],
    queryFn: () => apiFetch<{ data: { hubs: Hub[] } }>('/v1/hubs'),
  })

  const hubs = q.data?.data.hubs ?? []

  const [hubForm, setHubForm] = useState({
    name: '',
    code: '',
    latitude: '12.9716',
    longitude: '77.5946',
    pincode: '',
    city: '',
    state: '',
    address: '',
  })

  const createHub = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { hub: Hub } }>('/v1/hubs', {
        method: 'POST',
        body: {
          name: hubForm.name.trim(),
          code: hubForm.code.trim() || undefined,
          latitude: Number(hubForm.latitude),
          longitude: Number(hubForm.longitude),
          city: hubForm.city.trim() || undefined,
          state: hubForm.state.trim() || undefined,
          address: hubForm.address.trim() || undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'hubs'] })
      setHubForm((f) => ({
        ...f,
        name: '',
        code: '',
        pincode: '',
        city: '',
        state: '',
        address: '',
      }))
    },
  })

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
    {
      key: 'open',
      header: 'Console',
      render: (h) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/hubs/${h.id}`}>Open</Link>
        </Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">नया हब (पिनकोड से शहर)</CardTitle>
          <CardDescription>पिनकोड डालने पर जिला व राज्य भर जाएंगे</CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-xl flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            हब नाम
            <Input
              value={hubForm.name}
              onChange={(e) => setHubForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            कोड (वैकल्पिक)
            <Input
              value={hubForm.code}
              onChange={(e) => setHubForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <PincodeInput
            id="hub-pin"
            fieldLabel="हब पिनकोड"
            value={hubForm.pincode}
            onChange={(v) => setHubForm((f) => ({ ...f, pincode: v }))}
            onPincodeResolved={(p: PincodeLookupPayload) =>
              setHubForm((f) => ({
                ...f,
                pincode: p.pincode,
                city: p.city,
                state: p.state,
                address: f.address.trim() ? f.address : `${p.area}, ${p.city}`,
              }))
            }
          />
          {hubForm.city ? (
            <p className="text-xs text-muted-foreground">
              शहर: {hubForm.city} · राज्य: {hubForm.state}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              अक्षांश
              <Input
                value={hubForm.latitude}
                onChange={(e) => setHubForm((f) => ({ ...f, latitude: e.target.value }))}
                inputMode="decimal"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              देशांतर
              <Input
                value={hubForm.longitude}
                onChange={(e) => setHubForm((f) => ({ ...f, longitude: e.target.value }))}
                inputMode="decimal"
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            पता (वैकल्पिक)
            <Input
              value={hubForm.address}
              onChange={(e) => setHubForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          {createHub.isError ? (
            <p className="text-xs text-destructive">
              {createHub.error instanceof Error ? createHub.error.message : 'Failed'}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={createHub.isPending || !hubForm.name.trim()}
            onClick={() => void createHub.mutate()}
          >
            {createHub.isPending ? 'सेव…' : 'हब बनाएं'}
          </Button>
        </CardContent>
      </Card>

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
