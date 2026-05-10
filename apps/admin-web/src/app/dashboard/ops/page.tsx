'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery } from '@tanstack/react-query'

export default function OperationsCenterPage() {
  const ops = useQuery({
    queryKey: ['admin', 'ops-summary'],
    queryFn: () =>
      apiFetch<{ data: { summary: unknown } }>('/v1/admin/ops/summary'),
  })
  const logistics = useQuery({
    queryKey: ['admin', 'logistics'],
    queryFn: () =>
      apiFetch<{ data: unknown }>('/v1/admin/logistics/summary'),
  })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Operations center</h1>
      <section>
        <h2 className="text-lg font-semibold">Admin ops</h2>
        <pre className="mt-2 rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(ops.data?.data.summary ?? null, null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Logistics network</h2>
        <pre className="mt-2 rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(logistics.data?.data ?? null, null, 2)}
        </pre>
      </section>
    </div>
  )
}
