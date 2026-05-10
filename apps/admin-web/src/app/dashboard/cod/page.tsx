'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatDate, formatInrFromMinorUnits } from '../../../lib/format'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

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
      apiFetch<{ data: { orders: CodRow[]; total: number } }>(
        '/v1/admin/logistics/cod-orders?limit=80&offset=0'
      ),
  })

  const totalCod = (q.data?.data.orders ?? []).reduce((s, o) => s + o.codAmountCents, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">COD reports</h1>
        <p className="text-sm text-muted-foreground">
          Orders with COD &gt; 0 ({q.data?.data.total ?? '—'} rows). Sample total on page:{' '}
          <span className="font-medium tabular-nums">{formatInrFromMinorUnits(totalCod)}</span>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>COD pipeline</CardTitle>
          <CardDescription>Outstanding collection exposure by order</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load COD orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Order</th>
                    <th className="pb-2 pr-2 font-medium">Seller</th>
                    <th className="pb-2 pr-2 font-medium">COD</th>
                    <th className="pb-2 pr-2 font-medium">Updated</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.orders ?? []).map((o) => (
                    <tr key={o.publicId}>
                      <td className="py-2 pr-2 font-mono text-xs">
                        <Link
                          className="text-primary underline-offset-2 hover:underline"
                          href={`/dashboard/tracking/${encodeURIComponent(o.publicId)}`}
                        >
                          {o.publicId}
                        </Link>
                      </td>
                      <td className="py-2 pr-2">{o.seller.companyName ?? '—'}</td>
                      <td className="py-2 pr-2 tabular-nums font-medium">
                        {formatInrFromMinorUnits(o.codAmountCents)}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{formatDate(o.updatedAt)}</td>
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
