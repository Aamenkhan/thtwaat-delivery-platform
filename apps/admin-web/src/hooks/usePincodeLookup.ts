'use client'

import { useCallback, useState } from 'react'

export type PincodeLookupPayload = {
  pincode: string
  city: string
  state: string
  area: string
}

type ApiPincodeData = {
  pincode: string
  city: string
  state: string
  areas: string[]
}

export function usePincodeLookup() {
  const [loading, setLoading] = useState(false)
  const [areas, setAreas] = useState<string[]>([])
  const [error, setError] = useState('')

  const lookup = useCallback(async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) {
      setAreas([])
      return null
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/geo/pincode/${encodeURIComponent(pincode)}`)
      const json = (await res.json()) as
        | { ok: true; data: ApiPincodeData | null }
        | { ok: false; error?: { message?: string } }
      if (!res.ok || !json.ok) {
        setError('Pincode lookup failed')
        setAreas([])
        return null
      }
      if (!json.data) {
        setError('Invalid pincode')
        setAreas([])
        return null
      }
      setAreas(json.data.areas)
      return {
        city: json.data.city,
        state: json.data.state,
        areas: json.data.areas,
      }
    } catch {
      setError('Pincode lookup failed')
      setAreas([])
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setAreas([])
    setError('')
    setLoading(false)
  }, [])

  return { lookup, loading, areas, error, reset }
}
