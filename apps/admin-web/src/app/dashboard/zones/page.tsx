'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { useQuery } from '@tanstack/react-query'

type ZoneRow = {
  id: string
  code: string
  name: string
  active: boolean
  priority: number
  hub: { name: string; code: string | null; city: string | null }
}

export default function AdminDeliveryZonesPage() {
  const q = useQuery({
    queryKey: ['admin', 'hub-zones'],
    queryFn: () => apiFetch<{ data: { zones: ZoneRow[] } }>('/v1/admin/logistics/hub-zones'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery zones</h1>
        <p className="text-sm text-muted-foreground">Hub zones (`HubZone`) for geo / SLA routing.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hub zones</CardTitle>
          <CardDescription>Linked to parent hub</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load zones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Hub</th>
                    <th className="pb-2 pr-2 font-medium">Code</th>
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Priority</th>
                    <th className="pb-2 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.zones ?? []).map((z) => (
                    <tr key={z.id}>
                      <td className="py-2 pr-2">
                        <span className="font-medium">{z.hub.name}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {z.hub.city ?? z.hub.code ?? ''}
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{z.code}</td>
                      <td className="py-2 pr-2">{z.name}</td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">{z.priority}</td>
                      <td className="py-2">
                        {z.active ? <Badge>Active</Badge> : <Badge variant="muted">Off</Badge>}
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
