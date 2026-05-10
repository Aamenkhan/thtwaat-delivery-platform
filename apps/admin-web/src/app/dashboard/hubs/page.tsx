'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery } from '@tanstack/react-query'

export default function HubsPage() {
  const q = useQuery({
    queryKey: ['admin', 'hubs'],
    queryFn: () => apiFetch<{ data: { hubs: unknown[] } }>('/v1/hubs'),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Hubs</h1>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <pre className="rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(q.data?.data.hubs ?? [], null, 2)}
        </pre>
      )}
    </div>
  )
}
