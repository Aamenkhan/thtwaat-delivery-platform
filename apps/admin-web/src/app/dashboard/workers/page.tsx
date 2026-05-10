'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery } from '@tanstack/react-query'

export default function WorkersPage() {
  const q = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn: () =>
      apiFetch<{ data: { workers: unknown[] } }>('/v1/workers'),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Workers</h1>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <pre className="rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(q.data?.data.workers ?? [], null, 2)}
        </pre>
      )}
    </div>
  )
}
