'use client'

import { Suspense } from 'react'
import { apiFetch } from '@repo/web-core/api'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import Link from 'next/link'
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
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading shipments…</p>}>
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shipment overview</h1>
        <p className="text-sm text-muted-foreground">
          {q.data ? <>{q.data.data.total} orders match filters.</> : null}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Query params on `/v1/admin/shipments`</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Status</span>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Seller ID</span>
            <input
              className="rounded-md border bg-background px-2 py-1.5 text-sm font-mono"
              placeholder="cuid…"
              value={sellerId}
              onChange={(e) => setFilter('sellerId', e.target.value.trim())}
            />
          </label>
          <div className="flex items-end">
            <Button type="button" variant="outline" size="sm" onClick={() => router.push('/dashboard/shipments')}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Shipments</CardTitle>
            <CardDescription>Hub context + tracking</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/live">Live lookup</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load shipments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Public ID</th>
                    <th className="pb-2 pr-2 font-medium">Tracking</th>
                    <th className="pb-2 pr-2 font-medium">Seller</th>
                    <th className="pb-2 pr-2 font-medium">Route</th>
                    <th className="pb-2 pr-2 font-medium">Updated</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.orders ?? []).map((o) => (
                    <tr key={o.publicId}>
                      <td className="py-2 pr-2 font-mono text-xs">
                        <Link
                          href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {o.publicId}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {o.shipment?.trackingNumber ?? o.shipment?.trackingPublicId ?? '—'}
                      </td>
                      <td className="py-2 pr-2">{o.seller.companyName ?? o.seller.id.slice(0, 8)}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {(o.sourceHub?.code ?? o.sourceHub?.name ?? '—') +
                          ' → ' +
                          (o.destinationHub?.code ?? o.destinationHub?.name ?? '—')}
                      </td>
                      <td className="py-2 pr-2 text-xs">{formatDate(o.updatedAt)}</td>
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
