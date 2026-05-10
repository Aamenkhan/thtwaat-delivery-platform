'use client'

import { apiFetch } from '@repo/web-core/api'
import { createRealtimeSocket, subscribeOrderStatus } from '@repo/web-core/socket'
import { RazorpayCheckoutTrigger } from '../../../../components/razorpay-checkout-trigger'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FadeIn,
  PageHeader,
  Separator,
  Skeleton,
  StatusBadge,
  TrackingTimeline,
  orderStatusTone,
  type TrackingTimelineItem,
} from '@repo/ui'
import { Mail, MapPin, Phone, QrCode, Route, User } from 'lucide-react'
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
    estimatedDeliveryAt: string | null
    parcelType: string | null
    codAmountCents: number | null
    customer: { fullName: string; phone: string; email: string | null } | null
  }
  timeline: TimelineItem[]
}

function formatScanTitle(event: string) {
  return event
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
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

function extractParcelSummary(timeline: TimelineItem[]) {
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
      const p = row.payload as { amountCents?: number }
      if (typeof p.amountCents === 'number') out.pricingInr = p.amountCents / 100
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

function buildTimelineItems(timeline: TimelineItem[]): TrackingTimelineItem[] {
  return timeline.map((item) => {
    if (isScanItem(item)) {
      return {
        id: item.id,
        title: formatScanTitle(item.event),
        subtitle: [item.hubName, item.workerName].filter(Boolean).join(' · ') || undefined,
        timestamp: formatWhen(item.scannedAt),
        statusKey: item.event,
        meta: item.photoUrl ? (
          <a href={item.photoUrl} target="_blank" rel="noreferrer" className="text-primary underline">
            Proof photo
          </a>
        ) : undefined,
      }
    }
    const payload = item.payload
    const pricing =
      item.source === 'pricing' &&
      payload &&
      typeof payload === 'object' &&
      'amountCents' in payload &&
      typeof (payload as { amountCents: unknown }).amountCents === 'number'
        ? (payload as { amountCents: number; currency?: string })
        : null
    return {
      id: item.id,
      title: item.eventKey.replace(/[._]/g, ' '),
      subtitle: item.source,
      timestamp: formatWhen(item.scannedAt),
      statusKey: item.eventKey,
      meta: pricing ? (
        <span className="text-muted-foreground">
          Quoted{' '}
          <span className="font-semibold text-foreground">
            {pricing.currency === 'INR' || !pricing.currency ? '₹' : `${pricing.currency} `}
            {(pricing.amountCents / 100).toFixed(2)}
          </span>
        </span>
      ) : payload != null && typeof payload === 'object' ? (
        <pre className="max-h-24 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null,
    }
  })
}

export default function TrackingPage() {
  const params = useParams()
  const publicId = params.publicId as string
  const qc = useQueryClient()
  const [live, setLive] = useState<string | null>(null)
  const [payMsg, setPayMsg] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['tracking', publicId],
    queryFn: () => apiFetch<{ data: TrackingResponse }>(`/v1/tracking/${encodeURIComponent(publicId)}/timeline`),
    enabled: Boolean(publicId),
  })

  const shipQ = useQuery({
    queryKey: ['seller-shipment', publicId],
    queryFn: () =>
      apiFetch<{
        data: {
          order: { publicId: string; shippingPaidAt: string | null }
        }
      }>(`/v1/seller/shipments/${encodeURIComponent(publicId)}`),
    enabled: Boolean(publicId),
  })

  const data = q.data?.data
  const timeline = data?.timeline ?? []
  const parcel = useMemo(() => extractParcelSummary(timeline), [timeline])
  const mapCoords = useMemo(() => lastScanCoords(timeline), [timeline])
  const feePaise = parcel.pricingInr != null ? Math.max(0, Math.round(parcel.pricingInr * 100)) : 0
  const shippingPaidAt = shipQ.data?.data?.order?.shippingPaidAt ?? null
  const timelineItems = useMemo(() => buildTimelineItems(timeline), [timeline])

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

  const etaFormatted = data?.order.estimatedDeliveryAt
    ? formatWhen(data.order.estimatedDeliveryAt)
    : null
  const etaCopy = etaFormatted
    ? `Target window ${etaFormatted} — confirm with hub for live ETA.`
    : 'ETA updates when hubs publish revised windows.'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-24">
      <FadeIn>
        <PageHeader
          title="Shipment journey"
          description="Unified scan trail, pricing signals, and proof — optimized for mobile field teams and seller ops."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/shipments">Back to list</Link>
            </Button>
          }
        />
        <p className="-mt-4 font-mono text-xs text-muted-foreground break-all">{publicId}</p>
      </FadeIn>

      {live ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">{live}</div>
      ) : null}

      {q.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Unable to load tracking</CardTitle>
            <CardDescription>Network, auth, or shipment ID may be invalid.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" type="button" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card variant="elevated" className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">Current status</CardTitle>
                  <CardDescription>{data.order.lifecycle.replace(/_/g, ' ')}</CardDescription>
                </div>
                <StatusBadge tone={orderStatusTone(data.order.status)}>{data.order.status.replace(/_/g, ' ')}</StatusBadge>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <QrCode className="size-4" />
                    QR payload
                  </div>
                  <p className="mt-2 font-mono text-xs break-all leading-relaxed">{data.order.qrCode}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Route className="size-4" />
                    Tracking refs
                  </div>
                  <p className="mt-2 font-mono text-xs break-all">{data.order.trackingId ?? '—'}</p>
                  <p className="mt-1 font-mono text-xs">{data.order.trackingNumber ?? ''}</p>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Delivery ETA · </span>
                  {etaCopy}
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-base">Parcel</CardTitle>
                <CardDescription>From booking metadata & pricing events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{data.order.parcelType ?? parcel.parcelType ?? '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">COD</span>
                  <span className="font-medium">
                    {data.order.codAmountCents != null
                      ? `₹${(data.order.codAmountCents / 100).toFixed(2)}`
                      : parcel.codCents != null
                        ? `₹${(parcel.codCents / 100).toFixed(2)}`
                        : '—'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Quoted fare</span>
                  <span className="font-medium">
                    {parcel.pricingInr != null ? `₹${parcel.pricingInr.toFixed(2)}` : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.order.customer ? (
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4" />
                  Consignee
                </CardTitle>
                <CardDescription>Delivery contact on file</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/15 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
                  <p className="mt-1 font-medium">{data.order.customer.fullName}</p>
                </div>
                <div className="rounded-xl border bg-muted/15 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Phone className="size-3.5" />
                    Phone
                  </p>
                  <p className="mt-1 font-mono text-sm">{data.order.customer.phone}</p>
                </div>
                {data.order.customer.email ? (
                  <div className="sm:col-span-2 rounded-xl border bg-muted/15 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Mail className="size-3.5" />
                      Email
                    </p>
                    <p className="mt-1 text-sm">{data.order.customer.email}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {shippingPaidAt ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
              Shipment fee paid · {new Date(shippingPaidAt).toLocaleString()}
            </div>
          ) : feePaise >= 100 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shipment payment</CardTitle>
                <CardDescription>Quoted logistics fee ₹{(feePaise / 100).toFixed(2)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <RazorpayCheckoutTrigger
                  label="Pay with Razorpay"
                  createBody={{
                    purpose: 'SHIPMENT_FEE',
                    orderPublicId: publicId,
                    amountPaise: feePaise,
                  }}
                  onSettled={(outcome, detail) => {
                    if (outcome === 'success') {
                      setPayMsg('Payment recorded.')
                      void qc.invalidateQueries({ queryKey: ['seller-shipment', publicId] })
                    } else if (outcome === 'failed') {
                      setPayMsg(detail ?? 'Payment failed.')
                    } else {
                      setPayMsg('Checkout dismissed.')
                    }
                  }}
                />
                {payMsg ? <span className="text-xs text-muted-foreground">{payMsg}</span> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" />
                Route preview
              </CardTitle>
              <CardDescription>Drop-in Mapbox / Google Maps using last scan coordinates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-[21/9] w-full items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-gradient-to-br from-muted/40 to-muted/10">
                {mapCoords ? (
                  <div className="text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last fix</p>
                    <p className="mt-2 font-mono text-sm">
                      {mapCoords.lat.toFixed(5)}, {mapCoords.lng.toFixed(5)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Awaiting first GPS scan</p>
                )}
              </div>
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Journey timeline</h2>
            <TrackingTimeline items={timelineItems} />
          </section>
        </>
      ) : null}
    </div>
  )
}
