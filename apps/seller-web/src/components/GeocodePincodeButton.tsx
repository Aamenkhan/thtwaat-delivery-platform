'use client'

import { Button, toast } from '@repo/ui'
import { useState } from 'react'

export type GeocodePincodeResult = {
  pincode: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}

type ApiOk = {
  ok: true
  data: GeocodePincodeResult & { formattedAddress: string | null; provider: string }
}
type ApiErr = { ok: false; error?: { message?: string } }

export function GeocodePincodeButton({
  address,
  disabled,
  contextLabel,
  onResolved,
}: {
  address: string
  disabled?: boolean
  /** e.g. "पिकअप" / "डिलीवरी" for toast copy */
  contextLabel: string
  onResolved: (r: GeocodePincodeResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  async function run() {
    setHint(null)
    const q = address.trim()
    if (q.length < 8) {
      setHint('पहले पूरा पता लिखें (कम से कम 8 अक्षर)।')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q }),
      })
      const json = (await res.json()) as ApiOk | ApiErr
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          typeof json === 'object' && json !== null && 'error' in json
            ? (json as ApiErr).error?.message
            : undefined
        setHint(msg ?? `लुकअप असफल (${res.status})`)
        return
      }
      const d = json.data
      if (d.pincode) {
        onResolved({
          pincode: d.pincode,
          city: d.city,
          state: d.state,
          lat: d.lat,
          lng: d.lng,
        })
        toast.success(`${contextLabel}: पिनकोड ${d.pincode} भर दिया गया`)
        setHint(
          d.provider === 'nominatim'
            ? 'मुफ्त OSM लुकअप — भारी इस्तेमाल के लिए Google Geocoding API सेट करें।'
            : null
        )
      } else {
        setHint(
          'पिनकोड नहीं मिला — पता और स्पष्ट करें (गली, शहर, राज्य) या पिनकोड खुद डालें।'
        )
      }
    } catch {
      setHint('नेटवर्क / सर्वर त्रुटि। दोबारा कोशिश करें।')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled || loading}
        onClick={() => void run()}
      >
        {loading ? 'खोज रहे हैं…' : 'पते से पिनकोड लाएँ'}
      </Button>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
