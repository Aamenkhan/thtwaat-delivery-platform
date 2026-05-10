'use client'

import { apiFetch } from '@repo/web-core/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import { useQuery } from '@tanstack/react-query'

type Worker = {
  id: string
  displayName: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function WorkersPage() {
  const q = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn: () => apiFetch<{ data: { workers: Worker[] } }>('/v1/workers'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
        <p className="text-sm text-muted-foreground">Field and hub workforce directory.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>GET /v1/workers (platform admin)</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Could not load workers.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Phone</th>
                    <th className="pb-2 pr-2 font-medium">Role</th>
                    <th className="pb-2 pr-2 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(q.data?.data.workers ?? []).map((w) => (
                    <tr key={w.id}>
                      <td className="py-2 pr-2 font-medium">{w.displayName}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{w.phone ?? '—'}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {w.role.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{formatDate(w.createdAt)}</td>
                      <td className="py-2">{w.isActive ? <Badge>Yes</Badge> : <Badge variant="muted">No</Badge>}</td>
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
