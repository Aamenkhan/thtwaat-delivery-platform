'use client'

import { fetchIndiaPincodeLookup } from '@repo/web-core/india-pincode'
import { useCallback, useState } from 'react'

export type PincodeLookupPayload = {
  pincode: string
  city: string
  state: string
  area: string
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
      const result = await fetchIndiaPincodeLookup(pincode)
      if (!result) {
        setError('Invalid pincode')
        setAreas([])
        return null
      }
      setAreas(result.areas)
      return {
        city: result.city,
        state: result.state,
        areas: result.areas,
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
