/**
 * Server-only geocoding for India addresses → approximate PIN / city / state.
 * Used from `app/api/geocode/route.ts` so API keys stay off the client.
 *
 * - Set `GOOGLE_MAPS_GEOCODING_API_KEY` for production-quality results (Geocoding API).
 * - Without it, uses OpenStreetMap Nominatim (strict usage policy; light traffic only).
 */

export type GeocodeProvider = 'google' | 'nominatim'

export type GeocodeAddressData = {
  pincode: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  formattedAddress: string | null
  provider: GeocodeProvider
}

type NominatimItem = {
  lat?: string
  lon?: string
  display_name?: string
  address?: Record<string, string | undefined>
}

type GoogleGeocodeResponse = {
  status: string
  results?: Array<{
    formatted_address?: string
    geometry?: { location?: { lat?: number; lng?: number } }
    address_components?: Array<{
      long_name: string
      short_name: string
      types: string[]
    }>
  }>
  error_message?: string
}

function normalizeIndiaPincode(raw: string | undefined | null): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '').slice(0, 6)
  return /^\d{6}$/.test(d) ? d : null
}

function cityFromNominatimAddr(addr: Record<string, string | undefined>): string | null {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state_district ||
    null
  )
}

function nominatimUserAgent(): string {
  return (
    process.env.GEOCODE_USER_AGENT?.trim() ||
    'thtwaat-seller-web/1.0 (+https://github.com/Aamenkhan/thtwaat-delivery-platform)'
  )
}

async function nominatimGeocode(query: string): Promise<GeocodeAddressData> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'in')
  url.searchParams.set('q', query)

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': nominatimUserAgent(),
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`)
  }
  const list = (await res.json()) as NominatimItem[]
  const first = Array.isArray(list) ? list[0] : undefined
  if (!first?.address) {
    return {
      pincode: null,
      city: null,
      state: null,
      lat: null,
      lng: null,
      formattedAddress: null,
      provider: 'nominatim',
    }
  }
  const addr = first.address
  const pincode = normalizeIndiaPincode(addr.postcode)
  const city = cityFromNominatimAddr(addr)
  const state = addr.state ?? null
  const lat = first.lat != null ? Number(first.lat) : null
  const lng = first.lon != null ? Number(first.lon) : null
  return {
    pincode,
    city,
    state,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    formattedAddress: first.display_name ?? null,
    provider: 'nominatim',
  }
}

function parseGoogleFirstResult(
  r0: NonNullable<GoogleGeocodeResponse['results']>[0]
): Omit<GeocodeAddressData, 'provider'> {
  let pincode: string | null = null
  let city: string | null = null
  let state: string | null = null
  const loc = r0.geometry?.location
  const lat = loc?.lat != null && Number.isFinite(loc.lat) ? loc.lat : null
  const lng = loc?.lng != null && Number.isFinite(loc.lng) ? loc.lng : null

  for (const c of r0.address_components ?? []) {
    if (c.types.includes('postal_code')) {
      pincode = normalizeIndiaPincode(c.long_name) ?? pincode
    }
    if (c.types.includes('locality')) {
      city = city ?? c.long_name
    }
    if (c.types.includes('sublocality_level_1') && !city) {
      city = c.long_name
    }
    if (c.types.includes('administrative_area_level_1')) {
      state = c.long_name
    }
  }
  if (!city) {
    for (const c of r0.address_components ?? []) {
      if (c.types.includes('administrative_area_level_2')) {
        city = c.long_name
        break
      }
    }
  }
  return {
    pincode,
    city,
    state,
    lat,
    lng,
    formattedAddress: r0.formatted_address ?? null,
  }
}

async function googleGeocode(query: string, key: string): Promise<GeocodeAddressData> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('region', 'in')
  url.searchParams.set('components', 'country:IN')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) {
    throw new Error(`Google Geocoding HTTP ${res.status}`)
  }
  const data = (await res.json()) as GoogleGeocodeResponse
  if (data.status === 'ZERO_RESULTS') {
    return {
      pincode: null,
      city: null,
      state: null,
      lat: null,
      lng: null,
      formattedAddress: null,
      provider: 'google',
    }
  }
  if (data.status !== 'OK' || !data.results?.[0]) {
    throw new Error(data.error_message || `Google Geocoding: ${data.status}`)
  }
  const parsed = parseGoogleFirstResult(data.results[0])
  return { ...parsed, provider: 'google' }
}

export async function geocodeAddress(query: string): Promise<GeocodeAddressData> {
  const q = query.trim()
  if (q.length < 8) {
    return {
      pincode: null,
      city: null,
      state: null,
      lat: null,
      lng: null,
      formattedAddress: null,
      provider: 'nominatim',
    }
  }

  const googleKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim()
  if (googleKey) {
    return googleGeocode(q, googleKey)
  }

  if (process.env.DISABLE_NOMINATIM === '1') {
    return {
      pincode: null,
      city: null,
      state: null,
      lat: null,
      lng: null,
      formattedAddress: null,
      provider: 'nominatim',
    }
  }

  return nominatimGeocode(q)
}
