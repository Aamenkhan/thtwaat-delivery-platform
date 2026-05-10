'use client'

import { apiFetch } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

export default function TrackingPage() {
  const params = useParams()
  const publicId = params.publicId as string
  const qc = useQueryClient()
  const [live, setLive] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['tracking', publicId],
    queryFn: () =>
      apiFetch<{ data: { events?: unknown[]; order?: { status: string } } }>(
        `/v1/tracking/${encodeURIComponent(publicId)}/timeline`
      ),
    enabled: Boolean(publicId),
  })

  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!publicId) return
    const off = subscribeOrderStatus(socket, publicId, {
      onStatus: () => {
        setLive('Status updated')
        void qc.invalidateQueries({ queryKey: ['tracking', publicId] })
      },
      onTracking: () => {
        setLive('Tracking updated')
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tracking</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/shipments">Back</Link>
        </Button>
      </div>
      <p className="font-mono text-sm text-muted-foreground">{publicId}</p>
      {live ? <p className="text-sm text-primary">{live}</p> : null}
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load tracking.</p>
      ) : (
        <pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs">
          {JSON.stringify(q.data?.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
