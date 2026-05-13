'use client'

import { getApiBaseUrl } from '@repo/web-core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, StatusBadge, orderStatusTone } from '@repo/ui'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ShipmentVerticalTimeline, type VerticalTimelineStep } from '../../../components/shipment-vertical-timeline'

type TrackPayload = {
  orderNumber: string
  status: string
  type: string
  productName: string
  createdAt: string
  estimatedDelivery: string
  currentHub: { name: string; city: string | null } | null
  timeline: VerticalTimelineStep[]
  workerInfo: {
    pickupWorkerName: string | null
    deliveryWorkerName: string | null
  }
  otpVerified: boolean
}

async function fetchTrack(orderNumber: string): Promise<{ data: TrackPayload }> {
  const base = getApiBaseUrl()
  const res = await fetch(
    `${base}/api/v1/orders/qr/${encodeURIComponent(orderNumber)}`,
    { method: 'GET', cache: 'no-store' }
  )
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    data?: TrackPayload
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`)
  }
  if (!body.data) throw new Error('Invalid response')
  return { data: body.data }
}

export default function PublicTrackPage() {
  const params = useParams()
  const orderNumber = params.orderNumber as string

  const q = useQuery({
    queryKey: ['public-track', orderNumber],
    queryFn: () => fetchTrack(orderNumber),
    enabled: Boolean(orderNumber),
  })

  const d = q.data?.data

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-background px-4 py-10 pb-16">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thtwaat tracking</p>
        <h1 className="mt-1 text-2xl font-semibold">Shipment status</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground break-all">{orderNumber}</p>
      </div>

      {q.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load tracking</CardTitle>
            <CardDescription>{q.error instanceof Error ? q.error.message : 'Unknown error'}</CardDescription>
          </CardHeader>
        </Card>
      ) : d ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Current status</p>
              <p className="text-sm font-medium text-foreground">{d.productName}</p>
            </div>
            <StatusBadge tone={orderStatusTone(d.status)} className="text-sm px-3 py-1">
              {d.status.replace(/_/g, ' ')}
            </StatusBadge>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Route</CardTitle>
              <CardDescription>
                Hub:{' '}
                {d.currentHub
                  ? `${d.currentHub.name}${d.currentHub.city ? ` · ${d.currentHub.city}` : ''}`
                  : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Pickup agent</span>
                <span className="font-medium">{d.workerInfo.pickupWorkerName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Delivery rider</span>
                <span className="font-medium">{d.workerInfo.deliveryWorkerName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2 border-t pt-2">
                <span className="text-muted-foreground">Est. delivery</span>
                <span className="font-medium">
                  {new Date(d.estimatedDelivery).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h2>
            <ShipmentVerticalTimeline steps={d.timeline} />
          </section>
        </>
      ) : null}
    </div>
  )
}
