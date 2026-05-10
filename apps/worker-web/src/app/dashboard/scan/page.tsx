'use client'

import { apiFetch } from '@repo/web-core/api'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FadeIn,
  Input,
  Label,
  PageHeader,
  toast,
  cn,
} from '@repo/ui'
import { QrCode } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

const EVENTS = [
  'PICKUP_SCAN',
  'HUB_DROP_SCAN',
  'HUB_ACCEPT',
  'DELIVERY_SCAN',
  'DELIVERED',
  'BOOKING_RECEIVED',
] as const

const selectClass = cn(
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
)

export default function ScanPage() {
  const me = useQuery({
    queryKey: ['worker', 'me'],
    queryFn: () =>
      apiFetch<{ data: { worker: { id: string } } }>('/v1/workers/me'),
  })

  const [event, setEvent] = useState<string>('PICKUP_SCAN')
  const [qrCode, setQrCode] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function useGeo() {
    if (!navigator.geolocation) {
      setMsg('Geolocation not available')
      toast.error('Geolocation not available on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude)
        setLng(p.coords.longitude)
        setMsg(null)
        toast.success('GPS fix captured')
      },
      () => {
        setMsg('Could not read GPS')
        toast.error('Could not read GPS')
      }
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const workerId = me.data?.data.worker.id
    if (!workerId || lat == null || lng == null) {
      setMsg('Need worker profile and GPS coordinates.')
      toast.error('Complete profile load and GPS before submitting.')
      return
    }
    setPending(true)
    try {
      await apiFetch('/v1/scans', {
        method: 'POST',
        body: {
          event,
          qrCode,
          workerId,
          photoUrl: photoUrl || undefined,
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
        },
      })
      setMsg('Scan recorded.')
      toast.success('Scan recorded')
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Scan failed (check order status vs event).'
      setMsg(m)
      toast.error(m)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader
          title="Scan shipment"
          description="Event must align with order state (e.g. PICKUP_SCAN when CREATED). Proof URL is optional."
        />
      </FadeIn>

      <Card variant="elevated">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <QrCode className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">Hub / last-mile capture</CardTitle>
            <CardDescription>POST /v1/scans · auditable trail</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" size="sm" className="mb-6" onClick={useGeo}>
            Use device GPS
          </Button>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="event">Scan event</Label>
              <select
                id="event"
                className={selectClass}
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              >
                {EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr">Order QR code</Label>
              <Input id="qr" value={qrCode} onChange={(e) => setQrCode(e.target.value)} required placeholder="Paste QR payload" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo">Proof photo URL (optional)</Label>
              <Input
                id="photo"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lat ?? ''}
                  onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lng ?? ''}
                  onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              {pending ? 'Submitting…' : 'Submit scan'}
            </Button>
          </form>
          {msg ? <p className="mt-4 text-sm text-muted-foreground">{msg}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
