'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

type SellerRow = {
  id: string
  companyName: string | null
  createdAt: string
  user: { email: string | null; phone: string | null }
  organization: { name: string; slug: string } | null
  orderCount: number
}

export default function AdminSellersPage() {
  const q = useQuery({
    queryKey: ['admin', 'sellers'],
    queryFn: () =>
      apiFetch<{ data: { sellers: SellerRow[]; total: number } }>('/v1/admin/logistics/sellers?limit=100&offset=0'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seller management</h1>
        <p className="text-sm text-muted-foreground">
          Organizations and order volume.{' '}
          {q.data ? <span className="tabular-nums">({q.data.data.total} total)</span> : null}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sellers</CardTitle>
          <CardDescription>Recently created first</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load sellers.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Company</th>
                    <th className="pb-2 pr-3 font-medium">Email</th>
                    <th className="pb-2 pr-3 font-medium">Organization</th>
                    <th className="pb-2 pr-3 font-medium">Orders</th>
                    <th className="pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.sellers ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-3 font-medium">{s.companyName ?? '—'}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{s.user.email ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {s.organization ? (
                          <Badge variant="secondary">{s.organization.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{s.orderCount}</td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Tip: filter shipments by seller from{' '}
        <Link href="/dashboard/shipments" className="text-primary underline">
          Shipments
        </Link>
        .
      </p>
    </div>
  )
}
