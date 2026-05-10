'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useState } from 'react'

export default function GpsPage() {
  const [msg, setMsg] = useState<string | null>(null)

  function send() {
    setMsg(null)
    if (!navigator.geolocation) {
      setMsg('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await apiFetch('/v1/workers/me/ping', {
            method: 'POST',
            body: {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracyMeters: p.coords.accuracy,
            },
          })
          setMsg('GPS ping recorded (audit log).')
        } catch {
          setMsg('Ping failed.')
        }
      },
      () => setMsg('Permission denied or unavailable')
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Live GPS ping</h1>
      <p className="text-xs text-muted-foreground">
        Sends one sample to <code className="rounded bg-muted px-1">POST /v1/workers/me/ping</code> (audit +
        scalable stream can be added later).
      </p>
      <Button type="button" onClick={send}>
        Send current location
      </Button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  )
}
