'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from '@repo/ui'
import { formatInrFromMinorUnits } from '../../../lib/format'
import { DataTable, EmptyStateBox, SectionHeader, type ColDef } from '../../../components/ui-kit'
import { Layers, Scale, Tags, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

type Slab = {
  id: string
  code: string
  label: string
  minDeadWeightGrams: number
  maxDeadWeightGrams: number
  baseFeePaise: number
  per500gPaise: number | null
  active: boolean
}

export default function AdminPricingSlabsPage() {
  const q = useQuery({
    queryKey: ['admin', 'pricing-slabs'],
    queryFn: () => apiFetch<{ data: { slabs: Slab[] } }>('/v1/admin/logistics/pricing-slabs'),
  })

  const slabs = q.data?.data.slabs ?? []
  const stats = useMemo(() => {
    const active = slabs.filter((s) => s.active).length
    const avgBase = slabs.length > 0 ? slabs.reduce((a, s) => a + s.baseFeePaise, 0) / slabs.length : 0
    const minBase = slabs.length > 0 ? Math.min(...slabs.map((s) => s.baseFeePaise)) : 0
    const maxBase = slabs.length > 0 ? Math.max(...slabs.map((s) => s.baseFeePaise)) : 0
    return { active, total: slabs.length, avgBase, minBase, maxBase }
  }, [slabs])

  const columns: ColDef<Slab>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="size-3.5 text-primary" />
          </span>
          <div>
            <p className="font-mono text-xs font-semibold">{s.code}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'weight',
      header: 'Weight Range',
      render: (s) => (
        <div className="flex items-center gap-1 text-sm">
          <Scale className="size-3 text-muted-foreground" />
          <span className="tabular-nums text-muted-foreground">
            {s.minDeadWeightGrams.toLocaleString()}g — {s.maxDeadWeightGrams.toLocaleString()}g
          </span>
        </div>
      ),
    },
    {
      key: 'base',
      header: 'Base Fee',
      render: (s) => (
        <span className="font-semibold tabular-nums text-foreground">
          {formatInrFromMinorUnits(s.baseFeePaise)}
        </span>
      ),
    },
    {
      key: 'per500',
      header: '/500g Add-on',
      render: (s) => (
        <span className="tabular-nums text-muted-foreground">
          {s.per500gPaise != null ? formatInrFromMinorUnits(s.per500gPaise) : '—'}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (s) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
          s.active
            ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400'
            : 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20'
        }`}>
          {s.active && <span className="size-1.5 rounded-full bg-emerald-500" />}
          {s.active ? 'Active' : 'Off'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Pricing"
        title="India Pricing Slabs"
        description="National dead-weight bands used by the routing and quote engines"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Slabs" value={stats.total} hint="All weight bands" icon={Layers} color="primary" />
        <KpiCard label="Active Slabs" value={stats.active} hint="Currently in use" icon={Zap} color="success" />
        <KpiCard label="Min Base Fee" value={formatInrFromMinorUnits(stats.minBase)} hint="Lightest slab" icon={Tags} color="primary" />
        <KpiCard label="Max Base Fee" value={formatInrFromMinorUnits(stats.maxBase)} hint="Heaviest slab" icon={Tags} color="warning" />
      </div>

      {/* ── Visual slab ladder ── */}
      <Card>
        <CardHeader><CardTitle>Pricing Ladder</CardTitle></CardHeader>
        <CardContent>
          {slabs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {slabs.filter(s => s.active).map((s) => {
                const pct = Math.min(100, (s.baseFeePaise / stats.maxBase) * 100)
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">{s.code}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
                      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums text-xs font-semibold">{formatInrFromMinorUnits(s.baseFeePaise)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="shimmer h-32 rounded-xl" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="size-4 text-primary" />All Slabs</CardTitle></CardHeader>
        <CardContent>
          {q.isError ? (
            <EmptyStateBox icon={<Tags className="size-8 text-red-400/50" />} title="Failed to load slabs" description="Check API connectivity." />
          ) : (
            <DataTable columns={columns} data={slabs} minWidth="min-w-[700px]" isLoading={q.isLoading} emptyMessage="No pricing slabs configured." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
