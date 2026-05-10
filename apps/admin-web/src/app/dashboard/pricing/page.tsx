'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatInrFromMinorUnits } from '../../../lib/format'
import { useQuery } from '@tanstack/react-query'

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">India pricing slabs</h1>
        <p className="text-sm text-muted-foreground">National dead-weight bands (paise / INR).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Slabs</CardTitle>
          <CardDescription>`IndiaPricingSlab` — used by routing / quote engines</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load slabs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Code</th>
                    <th className="pb-2 pr-2 font-medium">Label</th>
                    <th className="pb-2 pr-2 font-medium">Weight (g)</th>
                    <th className="pb-2 pr-2 font-medium">Base</th>
                    <th className="pb-2 pr-2 font-medium">/500g</th>
                    <th className="pb-2 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.slabs ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-2 font-mono text-xs">{s.code}</td>
                      <td className="py-2 pr-2">{s.label}</td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                        {s.minDeadWeightGrams}–{s.maxDeadWeightGrams}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{formatInrFromMinorUnits(s.baseFeePaise)}</td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                        {s.per500gPaise != null ? formatInrFromMinorUnits(s.per500gPaise) : '—'}
                      </td>
                      <td className="py-2">
                        {s.active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="muted">Off</Badge>
                        )}
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
