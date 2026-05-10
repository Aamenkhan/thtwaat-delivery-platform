'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { useQuery } from '@tanstack/react-query'

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hubs</h1>
        <p className="text-sm text-muted-foreground">Network nodes for sort and last-mile.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All hubs</CardTitle>
          <CardDescription>GET /v1/hubs</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load hubs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Code</th>
                    <th className="pb-2 pr-2 font-medium">City</th>
                    <th className="pb-2 pr-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Coords</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.hubs ?? []).map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 pr-2 font-medium">{h.name}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{h.code ?? '—'}</td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {h.city ?? '—'}
                        {h.state ? `, ${h.state}` : ''}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {h.hubType.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {h.latitude.toFixed(3)}, {h.longitude.toFixed(3)}
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
