'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type Order = { publicId: string }

export default function PhotoProofPage() {
  const routes = useQuery({
    queryKey: ['worker', 'routes'],
    queryFn: () => apiFetch<{ data: { orders: Order[] } }>('/v1/workers/me/routes'),
  })
  const [publicId, setPublicId] = useState('')
  const [url, setUrl] = useState('https://via.placeholder.com/600x400.png?text=POD')
  const [msg, setMsg] = useState<string | null>(null)

  async function upload() {
    setMsg(null)
    if (!publicId) {
      setMsg('Select order')
      return
    }
    try {
      await apiFetch(`/v1/orders/${encodeURIComponent(publicId)}/photos`, {
        method: 'POST',
        body: { urls: [url] },
      })
      setMsg('Proof URLs attached to order.')
    } catch {
      setMsg('Failed (check auth and order access).')
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <h1 className="text-xl font-semibold">Proof photo (URL)</h1>
      <p className="text-xs text-muted-foreground">
        Production apps should upload to object storage, then call{' '}
        <code className="rounded bg-muted px-1">POST /v1/orders/:publicId/photos</code> with HTTPS URLs.
      </p>
      <label className="flex flex-col gap-1">
        Order
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={publicId}
          onChange={(e) => setPublicId(e.target.value)}
        >
          <option value="">Select…</option>
          {(routes.data?.data.orders ?? []).map((o) => (
            <option key={o.publicId} value={o.publicId}>
              {o.publicId}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Image URL
        <input
          className="rounded-md border px-2 py-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <Button type="button" onClick={() => void upload()}>
        Attach proof
      </Button>
      {msg ? <p className="text-xs">{msg}</p> : null}
    </div>
  )
}
