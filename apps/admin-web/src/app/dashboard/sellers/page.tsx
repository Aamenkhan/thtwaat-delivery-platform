'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import {
  AvatarInitials,
  DataTable,
  EmptyStateBox,
  SectionHeader,
  StatBanner,
  StatusPill,
  type ColDef,
} from '../../../components/ui-kit'
import Link from 'next/link'
import { ExternalLink, Package, Store } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

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

  const sellers = q.data?.data.sellers ?? []

  const stats = useMemo(() => {
    const totalOrders = sellers.reduce((s, r) => s + r.orderCount, 0)
    const withOrg = sellers.filter((s) => s.organization).length
    const top = [...sellers].sort((a, b) => b.orderCount - a.orderCount)[0]
    return { total: sellers.length, totalOrders, withOrg, topSeller: top?.companyName ?? '—' }
  }, [sellers])

  const columns: ColDef<SellerRow>[] = [
    {
      key: 'company',
      header: 'Seller',
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={s.companyName ?? s.user.email ?? '?'} size="sm" />
          <div>
            <p className="font-semibold leading-tight">{s.companyName ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{s.user.email ?? s.user.phone ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'org',
      header: 'Organization',
      render: (s) =>
        s.organization ? (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {s.organization.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'orders',
      header: 'Orders',
      render: (s) => (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 rounded-full bg-primary/30"
            style={{
              width: 60,
            }}
          >
            <div
              className="h-full rounded-full bg-brand-gradient"
              style={{
                width: `${Math.min(100, (s.orderCount / (stats.totalOrders || 1)) * 100 * sellers.length)}%`,
              }}
            />
          </div>
          <span className="tabular-nums text-sm font-semibold">{s.orderCount}</span>
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <Link
          href={`/dashboard/shipments?sellerId=${s.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Orders <ExternalLink className="size-3" />
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Sellers"
        title="Seller Management"
        description="Organizations and their order volumes across the network"
      />

      {/* ── Stats ── */}
      <StatBanner
        items={[
          { label: 'Total Sellers', value: stats.total, sub: `${stats.withOrg} in organizations` },
          { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), sub: 'Across all sellers' },
          { label: 'Top Seller', value: stats.topSeller, sub: 'By order volume' },
          { label: 'With Org', value: stats.withOrg, sub: 'In an organization', color: 'text-violet-600 dark:text-violet-400' },
        ]}
      />

      {/* ── Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4 text-primary" />
            Sellers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <EmptyStateBox
              icon={<Store className="size-8 text-red-400/50" />}
              title="Failed to load sellers"
              description="Check API connectivity."
            />
          ) : (
            <DataTable
              columns={columns}
              data={sellers}
              minWidth="min-w-[640px]"
              isLoading={q.isLoading}
              emptyMessage="No sellers found."
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: click the orders link on any seller to filter the{' '}
        <Link href="/dashboard/shipments" className="text-primary underline underline-offset-2">
          Shipments
        </Link>{' '}
        page.
      </p>
    </div>
  )
}
