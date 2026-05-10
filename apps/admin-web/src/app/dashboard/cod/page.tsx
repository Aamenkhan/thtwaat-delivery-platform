'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from '@repo/ui'
import { formatDate, formatInrFromMinorUnits } from '../../../lib/format'
import { DataTable, EmptyStateBox, SectionHeader, StatusPill, type ColDef } from '../../../components/ui-kit'
import Link from 'next/link'
import { Banknote, CreditCard, IndianRupee, TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

type CodRow = {
  publicId: string
  status: string
  codAmountCents: number
  updatedAt: string
  seller: { id: string; companyName: string | null }
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
}

export default function AdminCodReportsPage() {
  const q = useQuery({
    queryKey: ['admin', 'cod-orders'],
    queryFn: () =>
      apiFetch<{ data: { orders: CodRow[]; total: number } }>('/v1/admin/logistics/cod-orders?limit=80&offset=0'),
  })

  const orders = q.data?.data.orders ?? []
  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.codAmountCents, 0)
    const pending = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status))
    const pendingAmt = pending.reduce((s, o) => s + o.codAmountCents, 0)
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length
    return { total, pending: pending.length, pendingAmt, delivered }
  }, [orders])

  const columns: ColDef<CodRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <Link className="font-mono text-xs text-primary hover:underline underline-offset-2" href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}>
          {o.publicId}
        </Link>
      ),
    },
    { key: 'seller', header: 'Seller', render: (o) => <span className="font-medium">{o.seller.companyName ?? '—'}</span> },
    {
      key: 'amount',
      header: 'COD Amount',
      render: (o) => <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatInrFromMinorUnits(o.codAmountCents)}</span>,
    },
    { key: 'updated', header: 'Updated', render: (o) => <span className="text-xs text-muted-foreground">{formatDate(o.updatedAt)}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusPill status={o.status} /> },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader label="Finance" title="COD Reports" description={`Cash-on-delivery pipeline — ${q.data?.data.total ?? '—'} orders`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total COD" value={formatInrFromMinorUnits(stats.total)} hint="Sample (80 records)" icon={IndianRupee} color="primary" />
        <KpiCard label="Pending" value={formatInrFromMinorUnits(stats.pendingAmt)} hint={`${stats.pending} orders in flight`} icon={CreditCard} color="warning" />
        <KpiCard label="Pending Orders" value={stats.pending} hint="Not yet delivered" icon={TrendingDown} color="warning" />
        <KpiCard label="Delivered" value={stats.delivered} hint="COD collected" icon={Banknote} color="success" />
      </div>

      <Card>
        <CardHeader><CardTitle>Collection Pipeline</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pending vs. Delivered</span>
            <span className="font-semibold">{orders.length > 0 ? Math.round((stats.delivered / orders.length) * 100) : 0}% collected</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${orders.length > 0 ? (stats.delivered / orders.length) * 100 : 0}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Delivered: {stats.delivered}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Pending: {stats.pending}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="size-4 text-primary" />COD Pipeline</CardTitle></CardHeader>
        <CardContent>
          {q.isError ? (
            <EmptyStateBox icon={<Banknote className="size-8 text-red-400/50" />} title="Failed to load COD orders" description="Check API connectivity." />
          ) : (
            <DataTable columns={columns} data={orders} minWidth="min-w-[700px]" isLoading={q.isLoading} emptyMessage="No COD orders found." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
