'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

type Row = { publicId: string; status: string }

export default function ReturnsPage() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['seller', 'shipments', 'returns'],
    queryFn: () =>
      apiFetch<{ data: { shipments: Row[] } }>('/v1/seller/shipments?limit=30&page=1'),
  })

  async function requestReturn(publicId: string) {
    setBusy(publicId)
    setMsg(null)
    try {
      await apiFetch(`/v1/orders/${encodeURIComponent(publicId)}/return`, {
        method: 'POST',
        body: { reason: 'Seller requested via dashboard' },
      })
      setMsg(`Return initiated for ${publicId}`)
      void qc.invalidateQueries({ queryKey: ['seller', 'shipments'] })
    } catch {
      setMsg(`Could not start return for ${publicId} (status must be DELIVERED).`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Returns</h1>
      <p className="text-sm text-muted-foreground">
        Initiates <code className="rounded bg-muted px-1">POST /v1/orders/:publicId/return</code> for
        delivered orders.
      </p>
      {msg ? <p className="text-sm">{msg}</p> : null}
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {(q.data?.data.shipments ?? []).map((s) => (
            <li key={s.publicId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-mono text-xs">{s.publicId}</p>
                <p className="text-muted-foreground">{s.status}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/tracking/${s.publicId}`}>Track</Link>
                </Button>
                <Button
                  size="sm"
                  disabled={busy === s.publicId || s.status !== 'DELIVERED'}
                  onClick={() => void requestReturn(s.publicId)}
                >
                  {busy === s.publicId ? '…' : 'Request return'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
