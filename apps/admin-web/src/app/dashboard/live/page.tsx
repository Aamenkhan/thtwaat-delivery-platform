'use client'

import { apiFetch, getApiBaseUrl } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import {
  ActivityFeed,
  LivePill,
  MapPlaceholder,
  SectionHeader,
  type ColDef,
  DataTable,
  StatusPill,
} from '../../../components/ui-kit'
import { Radio, RefreshCw, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

type TimelineEvent = {
  id: string
  status: string
  note?: string
  createdAt?: string
  timestamp?: string
}

export default function LiveTrackingPage() {
  const qc = useQueryClient()
  const [ref, setRef] = useState('')
  const [publicId, setPublicId] = useState<string | null>(null)
  const [liveEvents, setLiveEvents] = useState<{ id: string; title: string; time: string; type: 'info' | 'success' | 'warning' }[]>([])
  const eventCounter = useRef(0)

  const publicQ = useQuery({
    queryKey: ['public-timeline', ref],
    queryFn: async () => {
      const res = await fetch(
        `${getApiBaseUrl()}/v1/tracking/public/${encodeURIComponent(ref)}/timeline`
      )
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { data: { events?: TimelineEvent[]; status?: string } }
    },
    enabled: ref.length > 8,
  })

  const authedQ = useQuery({
    queryKey: ['tracking', publicId],
    queryFn: () =>
      apiFetch<{ data: { events?: TimelineEvent[]; status?: string } }>(
        `/v1/tracking/${encodeURIComponent(publicId!)}/timeline`
      ),
    enabled: Boolean(publicId),
  })

  const socket = useMemo(() => createRealtimeSocket(), [])

  useEffect(() => {
    if (!publicId) return
    const off = subscribeOrderStatus(socket, publicId, {
      onStatus: () => {
        eventCounter.current++
        setLiveEvents((prev) => [
          {
            id: String(eventCounter.current),
            title: `Status update received for ${publicId}`,
            time: new Date().toLocaleTimeString(),
            type: 'success' as const,
          },
          ...prev.slice(0, 9),
        ])
        void qc.invalidateQueries({ queryKey: ['tracking', publicId] })
      },
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [publicId, qc, socket])

  // Build timeline from API events
  const timelineItems = useMemo(() => {
    const events = authedQ.data?.data?.events ?? publicQ.data?.data?.events ?? []
    return events.map((e: TimelineEvent, i: number) => ({
      id: String(i),
      title: e.status?.replace(/_/g, ' ') ?? 'Event',
      subtitle: e.note,
      time: e.createdAt
        ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : e.timestamp
        ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      type: e.status === 'DELIVERED' ? 'success' as const : e.status === 'CANCELLED' ? 'error' as const : 'info' as const,
    }))
  }, [authedQ.data, publicQ.data])

  const currentStatus = authedQ.data?.data?.status ?? publicQ.data?.data?.status

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Live"
        title="Live Tracking"
        description="Real-time order lookup with Socket.IO push updates"
        actions={
          liveEvents.length > 0 ? (
            <LivePill text={`${liveEvents.length} live event${liveEvents.length > 1 ? 's' : ''}`} />
          ) : undefined
        }
      />

      {/* ── Map ── */}
      <MapPlaceholder height={300} label="Live Delivery Map" />

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Public timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4 text-primary" />
              Public Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Unauthenticated —{' '}
              <code className="rounded bg-muted px-1">GET /v1/tracking/public/:ref/timeline</code>
            </p>
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
                placeholder="Tracking ID or tracking number"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 gap-1.5"
                onClick={() => void publicQ.refetch()}
              >
                <RefreshCw className={`size-3.5 ${publicQ.isFetching ? 'animate-spin' : ''}`} />
                Load
              </Button>
            </div>
            {publicQ.isError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Tracking reference not found.
              </p>
            )}
            {timelineItems.length > 0 && !publicId && (
              <ActivityFeed items={timelineItems} />
            )}
          </CardContent>
        </Card>

        {/* Auth timeline + socket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-4 text-primary" />
              Authenticated + Socket.IO
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Authenticated with real-time push updates on status changes
            </p>
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
                placeholder="Order public ID"
                value={publicId ?? ''}
                onChange={(e) => setPublicId(e.target.value || null)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 gap-1.5"
                onClick={() => void authedQ.refetch()}
              >
                <RefreshCw className={`size-3.5 ${authedQ.isFetching ? 'animate-spin' : ''}`} />
                Load
              </Button>
            </div>
            {currentStatus && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Current status:</span>
                <StatusPill status={currentStatus} pulse={currentStatus === 'OUT_FOR_DELIVERY'} />
              </div>
            )}
            {timelineItems.length > 0 && publicId && (
              <ActivityFeed items={timelineItems} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Live event feed ── */}
      {liveEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-4 text-emerald-500" />
              Live Events
              <span className="ml-auto flex h-5 items-center rounded-full bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {liveEvents.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={liveEvents} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
