'use client'

import { apiFetch } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

type ScanTimelineItem = {
  id: string
  kind: 'scan'
  event: string
  qrCode: string
  workerId: string | null
  workerName: string
  photoUrl: string
  latitude: number
  longitude: number
  scannedAt: string
  hubId: string | null
  hubName: string | null
  metadata: Record<string, unknown> | null
}

type PlatformTimelineItem = {
  id: string
  kind: 'platform'
  eventKey: string
  source: string
  payload: unknown
  scannedAt: string
}

type TimelineItem = ScanTimelineItem | PlatformTimelineItem

type TrackingResponse = {
  order: {
    publicId: string
    status: string
    lifecycle: string
    qrCode: string
    trackingId: string | null
    trackingNumber: string | null
  }
  timeline: TimelineItem[]
}

type Phase = 'booking' | 'pickup' | 'transit' | 'out' | 'delivered' | 'return' | 'other'

function scanEventPhase(event: string): Phase {
  switch (event) {
    case 'BOOKING_RECEIVED':
      return 'booking'
    case 'PICKUP_SCAN':
    case 'SELLER_CONFIRM':
      return 'pickup'
    case 'HUB_DROP_SCAN':
    case 'HUB_ACCEPT':
    case 'RETURN_SCAN':
    case 'RETURN_HUB_ACCEPT':
      return 'transit'
    case 'DELIVERY_SCAN':
    case 'OTP_VERIFY':
      return 'out'
    case 'DELIVERED':
      return 'delivered'
    case 'RETURN_INIT':
      return 'return'
    default:
      return 'other'
  }
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'booking':
      return 'Booking received'
    case 'pickup':
      return 'Picked up'
    case 'transit':
      return 'In transit'
    case 'out':
      return 'Out for delivery'
    case 'delivered':
      return 'Delivered'
    case 'return':
      return 'Return'
    default:
      return 'Update'
  }
}

function phaseBadgeClass(phase: Phase): string {
  switch (phase) {
    case 'booking':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
    case 'pickup':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
    case 'transit':
      return 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
    case 'out':
      return 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'
    case 'delivered':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
    case 'return':
      return 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toUpperCase()
  if (s.includes('DELIVERED')) return 'bg-emerald-600 text-white'
  if (s.includes('OUT_FOR') || s.includes('DELIVERY')) return 'bg-amber-500 text-white'
  if (s.includes('TRANSIT') || s.includes('HUB')) return 'bg-violet-600 text-white'
  if (s.includes('PICKED') || s.includes('PICKUP')) return 'bg-sky-600 text-white'
  if (s.includes('CANCEL')) return 'bg-red-600 text-white'
  return 'bg-slate-600 text-white'
}

function formatScanTitle(event: string): string {
  return event
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function isScanItem(item: TimelineItem): item is ScanTimelineItem {
  return item.kind === 'scan'
}

function isPlatformItem(item: TimelineItem): item is PlatformTimelineItem {
  return item.kind === 'platform'
}

function extractParcelSummary(timeline: TimelineItem[]): {
  parcelType?: string
  codCents?: number
  channel?: string
  pricingInr?: number
} {
  const out: {
    parcelType?: string
    codCents?: number
    channel?: string
    pricingInr?: number
  } = {}
  for (const row of timeline) {
    if (isScanItem(row) && row.metadata && typeof row.metadata === 'object') {
      const m = row.metadata as Record<string, unknown>
      if (typeof m.parcelType === 'string') out.parcelType = m.parcelType
      if (typeof m.codAmountCents === 'number') out.codCents = m.codAmountCents
      if (typeof m.channel === 'string') out.channel = m.channel
    }
    if (isPlatformItem(row) && row.source === 'pricing' && row.payload && typeof row.payload === 'object') {
      const p = row.payload as { amountCents?: number; currency?: string }
      if (typeof p.amountCents === 'number') {
        out.pricingInr = p.amountCents / 100
      }
    }
  }
  return out
}

function lastScanCoords(timeline: TimelineItem[]): { lat: number; lng: number } | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const row = timeline[i]
    if (isScanItem(row) && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
      return { lat: row.latitude, lng: row.longitude }
    }
  }
  return null
}

export default function TrackingPage() {
  const params = useParams()
  const publicId = params.publicId as string
  const qc = useQueryClient()
  const [live, setLive] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['tracking', publicId],
    queryFn: () => apiFetch<{ data: TrackingResponse }>(`/v1/tracking/${encodeURIComponent(publicId)}/timeline`),
    enabled: Boolean(publicId),
  })

  const data = q.data?.data
  const timeline = data?.timeline ?? []
  const parcel = useMemo(() => extractParcelSummary(timeline), [timeline])
  const mapCoords = useMemo(() => lastScanCoords(timeline), [timeline])

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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shipment tracking</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{publicId}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/shipments">Back</Link>
        </Button>
      </div>

      {live ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{live}</p>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load tracking.</p>
      ) : data ? (
        <>
          <OrderSummaryCard order={data.order} />
          <ParcelAndMapSection parcel={parcel} coords={mapCoords} />
          <TimelineSection timeline={timeline} />
        </>
      ) : null}
    </div>
  )
}

function OrderSummaryCard({ order }: { order: TrackingResponse['order'] }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Current status</h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${orderStatusBadgeClass(order.status)}`}
        >
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Lifecycle</dt>
          <dd className="font-medium">{order.lifecycle.replace(/_/g, ' ')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">QR code</dt>
          <dd className="font-mono text-xs break-all">{order.qrCode}</dd>
        </div>
        {order.trackingId ? (
          <div>
            <dt className="text-muted-foreground">Tracking ID</dt>
            <dd className="font-mono text-xs break-all">{order.trackingId}</dd>
          </div>
        ) : null}
        {order.trackingNumber ? (
          <div>
            <dt className="text-muted-foreground">Tracking #</dt>
            <dd className="font-mono text-xs">{order.trackingNumber}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function ParcelAndMapSection({
  parcel,
  coords,
}: {
  parcel: ReturnType<typeof extractParcelSummary>
  coords: { lat: number; lng: number } | null
}) {
  const hasParcel =
    parcel.parcelType != null ||
    parcel.codCents != null ||
    parcel.channel != null ||
    parcel.pricingInr != null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Parcel details</h2>
        {!hasParcel ? (
          <p className="mt-3 text-sm text-muted-foreground">No parcel metadata on this timeline yet.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm">
            {parcel.parcelType ? (
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{parcel.parcelType}</dd>
              </div>
            ) : null}
            {parcel.codCents != null ? (
              <div>
                <dt className="text-muted-foreground">COD</dt>
                <dd className="font-medium">
                  ₹{(parcel.codCents / 100).toFixed(2)} <span className="text-muted-foreground">INR</span>
                </dd>
              </div>
            ) : null}
            {parcel.pricingInr != null ? (
              <div>
                <dt className="text-muted-foreground">Quoted fare (from timeline)</dt>
                <dd className="font-medium">₹{parcel.pricingInr.toFixed(2)}</dd>
              </div>
            ) : null}
            {parcel.channel ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Channel</dt>
                <dd className="font-mono text-xs break-all text-muted-foreground">{parcel.channel}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Route map</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Map preview placeholder — plug in Mapbox / Google Maps with the coordinates below.
        </p>
        <div className="mt-4 flex aspect-[4/3] w-full items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30">
          {coords ? (
            <div className="px-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Last scan location</p>
              <p className="mt-2 font-mono text-sm">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No coordinates yet</p>
          )}
        </div>
      </section>
    </div>
  )
}

function TimelineSection({ timeline }: { timeline: TimelineItem[] }) {
  if (timeline.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        No tracking events yet.
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold">Timeline</h2>
      <ul className="space-y-0">
        {timeline.map((item, index) => {
          const isLast = index === timeline.length - 1
          return (
            <li key={item.id} className="relative flex gap-4 pb-10 last:pb-0">
              <div className="relative flex w-11 shrink-0 flex-col items-center pt-1">
                {!isLast ? (
                  <span
                    className="absolute left-1/2 top-3 z-0 h-full w-px -translate-x-1/2 bg-border"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-background bg-primary shadow-sm" />
              </div>
              <div className="min-w-0 flex-1 pt-0">
                {isScanItem(item) ? (
                  <ScanTimelineCard item={item} isLatest={isLast} />
                ) : (
                  <PlatformTimelineCard item={item} />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ScanTimelineCard({ item, isLatest }: { item: ScanTimelineItem; isLatest: boolean }) {
  const phase = scanEventPhase(item.event)
  const phaseLbl = phaseLabel(phase)
  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-sm transition-shadow sm:p-5 ${isLatest ? 'ring-1 ring-primary/20' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{phaseLbl}</p>
          <h3 className="mt-0.5 text-base font-semibold">{formatScanTitle(item.event)}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${phaseBadgeClass(phase)}`}>
          {item.event.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{formatWhen(item.scannedAt)}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Hub</dt>
          <dd className="font-medium">{item.hubName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Worker</dt>
          <dd className="font-medium">{item.workerName}</dd>
        </div>
      </dl>
      {item.photoUrl ? (
        <a
          href={item.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs text-primary underline"
        >
          View proof photo
        </a>
      ) : null}
    </article>
  )
}

function PlatformTimelineCard({ item }: { item: PlatformTimelineItem }) {
  const payload = item.payload
  const pricing =
    item.source === 'pricing' &&
    payload &&
    typeof payload === 'object' &&
    'amountCents' in payload &&
    typeof (payload as { amountCents: unknown }).amountCents === 'number'
      ? (payload as { amountCents: number; currency?: string })
      : null

  return (
    <article className="rounded-2xl border border-dashed bg-muted/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold capitalize">{item.eventKey.replace(/[._]/g, ' ')}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{item.source}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{formatWhen(item.scannedAt)}</p>
      {pricing ? (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Quoted </span>
          <span className="font-semibold">
            {pricing.currency === 'INR' || !pricing.currency ? '₹' : `${pricing.currency} `}
            {(pricing.amountCents / 100).toFixed(2)}
          </span>
        </p>
      ) : payload != null && typeof payload === 'object' ? (
        <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </article>
  )
}
