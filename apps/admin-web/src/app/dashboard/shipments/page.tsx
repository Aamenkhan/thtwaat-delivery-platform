'use client'

import { Suspense } from 'react'
import { apiFetch } from '@repo/web-core/api'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import {
  DataTable,
  FilterBar,
  FilterInput,
  FilterSelect,
  LivePill,
  SectionHeader,
  StatusPill,
  type ColDef,
} from '../../../components/ui-kit'
import Link from 'next/link'
import { ArrowRight, Map, Package, Radio } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

type OrderRow = {
  publicId: string
  status: string
  updatedAt: string
  seller: { id: string; companyName: string | null }
  customer: { fullName: string; phone: string } | null
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
  sourceHub: { name: string; code: string | null } | null
  destinationHub: { name: string; code: string | null } | null
}

const STATUSES = [
  'CREATED',
  'PICKUP_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const

export default function AdminShipmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shimmer h-10 rounded-xl" />
          ))}
        </div>
      }
    >
      <AdminShipmentsBody />
    </Suspense>
  )
}

function AdminShipmentsBody() {
  const router = useRouter()
  const sp = useSearchParams()
  const status = sp.get('status') ?? ''
  const sellerId = sp.get('sellerId') ?? ''

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '40')
    p.set('offset', '0')
    if (status) p.set('status', status)
    if (sellerId) p.set('sellerId', sellerId)
    return p.toString()
  }, [status, sellerId])

  const q = useQuery({
    queryKey: ['admin', 'shipments', qs],
    queryFn: () =>
      apiFetch<{ data: { orders: OrderRow[]; total: number } }>(`/v1/admin/shipments?${qs}`),
  })

  const setFilter = useCallback(
    (key: string, value: string) => {
      const n = new URLSearchParams(sp.toString())
      if (value) n.set(key, value)
      else n.delete(key)
      router.push(`/dashboard/shipments?${n.toString()}`)
    },
    [router, sp]
  )

  const columns: ColDef<OrderRow>[] = [
    {
      key: 'id',
      header: 'Order ID',
      render: (o) => (
        <Link
          href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {o.publicId}
        </Link>
      ),
    },
    {
      key: 'tracking',
      header: 'Tracking',
      render: (o) => (
        <span className="font-mono text-xs text-muted-foreground">
          {o.shipment?.trackingNumber ?? o.shipment?.trackingPublicId ?? '—'}
        </span>
      ),
    },
    {
      key: 'seller',
      header: 'Seller',
      render: (o) => (
        <span className="font-medium">{o.seller.companyName ?? o.seller.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (o) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{o.sourceHub?.code ?? o.sourceHub?.name ?? '—'}</span>
          <ArrowRight className="size-3 shrink-0" />
          <span>{o.destinationHub?.code ?? o.destinationHub?.name ?? '—'}</span>
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (o) => <span className="text-xs text-muted-foreground">{formatDate(o.updatedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <StatusPill status={o.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Logistics"
        title="Shipment Overview"
        description={
          q.data
            ? `${q.data.data.total.toLocaleString()} orders match current filters`
            : 'Manage and track all network shipments'
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/live">
              <Radio className="mr-2 size-4" />
              Live map
            </Link>
          </Button>
        }
      />

      {/* ── Filters ── */}
      <FilterBar onClear={() => router.push('/dashboard/shipments')}>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setFilter('status', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          ]}
        />
        <FilterInput
          label="Seller ID"
          value={sellerId}
          onChange={(v) => setFilter('sellerId', v.trim())}
          placeholder="cuid…"
        />
      </FilterBar>

      {/* ── Status chips (quick filter) ── */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter('status', status === s ? '' : s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all ${
              status === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            Shipments
          </CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/live">
              <Map className="mr-2 size-4" />
              Live lookup
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={q.data?.data.orders ?? []}
            minWidth="min-w-[900px]"
            isLoading={q.isLoading}
            emptyMessage="No shipments match the selected filters."
          />
        </CardContent>
      </Card>
    </div>
  )
}
