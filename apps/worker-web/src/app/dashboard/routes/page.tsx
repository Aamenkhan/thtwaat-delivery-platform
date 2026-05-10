'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery } from '@tanstack/react-query'

type Order = {
  id: string
  publicId: string
  status: string
  qrCode: string
  customer: { fullName: string; phone: string } | null
}

export default function MyRoutesPage() {
  const q = useQuery({
    queryKey: ['worker', 'routes'],
    queryFn: () =>
      apiFetch<{ data: { orders: Order[] } }>('/v1/workers/me/routes'),
  })

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">My routes</h1>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {(q.data?.data.orders ?? []).map((o) => (
            <li key={o.id} className="space-y-1 px-3 py-3">
              <p className="font-mono text-xs">{o.publicId}</p>
              <p>{o.status}</p>
              <p className="text-xs text-muted-foreground">QR: {o.qrCode}</p>
              <p className="text-xs">
                {o.customer?.fullName} · {o.customer?.phone}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
