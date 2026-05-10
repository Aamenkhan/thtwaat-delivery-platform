'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
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

  function useGeo() {
    if (!navigator.geolocation) {
      setMsg('Geolocation not available')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude)
        setLng(p.coords.longitude)
      },
      () => setMsg('Could not read GPS')
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const workerId = me.data?.data.worker.id
    if (!workerId || lat == null || lng == null) {
      setMsg('Need worker profile and GPS coordinates.')
      return
    }
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
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Scan failed (check order status vs event).')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Scan QR</h1>
      <p className="text-xs text-muted-foreground">
        POST <code className="rounded bg-muted px-1">/v1/scans</code>. Event must match order
        status (e.g. PICKUP_SCAN when CREATED).
      </p>
      <Button type="button" variant="secondary" size="sm" onClick={useGeo}>
        Use device GPS
      </Button>
      <form className="space-y-2 text-sm" onSubmit={submit}>
        <label className="flex flex-col gap-1">
          Event
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Order QR code
          <input
            className="rounded-md border px-2 py-1"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Proof photo URL (optional)
          <input
            className="rounded-md border px-2 py-1"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="flex flex-col gap-1">
          Latitude
          <input
            type="number"
            step="any"
            className="rounded-md border px-2 py-1"
            value={lat ?? ''}
            onChange={(e) => setLat(Number(e.target.value))}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Longitude
          <input
            type="number"
            step="any"
            className="rounded-md border px-2 py-1"
            value={lng ?? ''}
            onChange={(e) => setLng(Number(e.target.value))}
            required
          />
        </label>
        <Button type="submit">Submit scan</Button>
      </form>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  )
}
