'use client'

import { apiFetch } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../../lib/format'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

type TimelineScan = {
  id: string
  kind: 'scan'
  event: string
  workerName: string
  hubName: string | null
  scannedAt: string
}

type TimelinePlatform = {
  id: string
  kind: 'platform'
  eventKey: string
  source: string
  scannedAt: string
}

type TimelineItem = TimelineScan | TimelinePlatform

type TrackingData = {
  order: { publicId: string; status: string; lifecycle: string }
  timeline: TimelineItem[]
}

export default function AdminTrackingDetailPage() {
  const params = useParams()
  const publicId = params.publicId as string
  const qc = useQueryClient()
  const [live, setLive] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['admin-tracking', publicId],
    queryFn: () => apiFetch<{ data: TrackingData }>(`/v1/tracking/${encodeURIComponent(publicId)}/timeline`),
    enabled: Boolean(publicId),
  })

  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!publicId) return
    const off = subscribeOrderStatus(socket, publicId, {
      onStatus: () => {
        setLive('Updated')
        void qc.invalidateQueries({ queryKey: ['admin-tracking', publicId] })
      },
      onTracking: () => {
        setLive('Updated')
        void qc.invalidateQueries({ queryKey: ['admin-tracking', publicId] })
      },
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [publicId, qc, socket])

  const d = q.data?.data

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tracking</h1>
          <p className="font-mono text-xs text-muted-foreground">{publicId}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/shipments">Shipments</Link>
        </Button>
      </div>
      {live ? <p className="text-sm text-primary">{live}</p> : null}
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load timeline.</p>
      ) : d ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Order</CardTitle>
              <CardDescription>Current network status</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Badge>{d.order.status.replace(/_/g, ' ')}</Badge>
              <span className="text-sm text-muted-foreground">
                Lifecycle: {d.order.lifecycle.replace(/_/g, ' ')}
              </span>
            </CardContent>
          </Card>
          <ul className="space-y-3">
            {d.timeline.map((ev) => (
              <li key={ev.id}>
                {ev.kind === 'scan' ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{ev.event.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(ev.scannedAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {ev.hubName ?? '—'} · {ev.workerName}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{ev.eventKey}</span>
                        <Badge variant="outline">{ev.source}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(ev.scannedAt)}</p>
                    </CardContent>
                  </Card>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
