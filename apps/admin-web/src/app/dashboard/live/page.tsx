'use client'

import { apiFetch, getApiBaseUrl } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Button } from '@repo/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

export default function LiveTrackingPage() {
  const qc = useQueryClient()
  const [ref, setRef] = useState('')
  const [publicId, setPublicId] = useState<string | null>(null)
  const [live, setLive] = useState<string | null>(null)

  const publicQ = useQuery({
    queryKey: ['public-timeline', ref],
    queryFn: async () => {
      const res = await fetch(
        `${getApiBaseUrl()}/v1/tracking/public/${encodeURIComponent(ref)}/timeline`
      )
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { data: unknown }
    },
    enabled: ref.length > 8,
  })

  const authedQ = useQuery({
    queryKey: ['tracking', publicId],
    queryFn: () =>
      apiFetch<{ data: unknown }>(
        `/v1/tracking/${encodeURIComponent(publicId!)}/timeline`
      ),
    enabled: Boolean(publicId),
  })

  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!publicId) return
    const off = subscribeOrderStatus(socket, publicId, {
      onStatus: () => {
        setLive('Order status (socket)')
        void qc.invalidateQueries({ queryKey: ['tracking', publicId] })
      },
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [publicId, qc, socket])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Live tracking</h1>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Public timeline (tracking ref)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Uses unauthenticated <code className="rounded bg-muted px-1">GET /v1/tracking/public/:ref/timeline</code>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder="trackingPublicId or trackingNumber"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => void publicQ.refetch()}>
            Load
          </Button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto text-xs">
          {JSON.stringify(publicQ.data?.data ?? null, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Authenticated timeline + Socket.IO</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder="order publicId"
            value={publicId ?? ''}
            onChange={(e) => setPublicId(e.target.value || null)}
          />
          <Button type="button" variant="secondary" onClick={() => void authedQ.refetch()}>
            Load
          </Button>
        </div>
        {live ? <p className="mt-2 text-xs text-primary">{live}</p> : null}
        <pre className="mt-3 max-h-56 overflow-auto text-xs">
          {JSON.stringify(authedQ.data?.data ?? null, null, 2)}
        </pre>
      </section>
    </div>
  )
}
