'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

type Row = {
  publicId: string
  status: string
  shipment: { trackingNumber: string | null; trackingPublicId: string } | null
}

export default function ShipmentsPage() {
  const q = useQuery({
    queryKey: ['seller', 'shipments', 'all'],
    queryFn: () =>
      apiFetch<{ data: { shipments: Row[]; page: number } }>(
        '/v1/seller/shipments?limit=50&page=1'
      ),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Shipments</h1>
        <Button asChild>
          <Link href="/dashboard/shipments/new">Create shipment</Link>
        </Button>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load shipments.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {(q.data?.data.shipments ?? []).map((s) => (
            <li key={s.publicId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-mono text-xs">{s.publicId}</p>
                <p className="text-muted-foreground">
                  {s.shipment?.trackingNumber ?? s.shipment?.trackingPublicId ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span>{s.status}</span>
                <Link className="text-xs text-primary underline" href={`/dashboard/tracking/${s.publicId}`}>
                  Track
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
