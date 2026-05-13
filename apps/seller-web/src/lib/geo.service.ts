/**
 * Free India geo: PostalPincode.in + OpenStreetMap Nominatim.
 *
 * Cost comparison (approximate list pricing, varies by region/SKU):
 * - Google Places / Geocoding: paid per request
 * - Nominatim (OSM): free, no key; follow usage policy + attribution
 * - api.postalpincode.in: free, no key
 *
 * Nominatim: respect ~1 req/sec — throttle server-side before outbound calls.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const POSTAL_BASE = 'https://api.postalpincode.in'
export const NOMINATIM_USER_AGENT = 'Thtwaat-Delivery-App'

const NOMINATIM_MIN_INTERVAL_MS = 1100
let lastNominatimAt = 0

async function throttleNominatim(): Promise<void> {
  const now = Date.now()
  const wait = lastNominatimAt + NOMINATIM_MIN_INTERVAL_MS - now
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  lastNominatimAt = Date.now()
}

type PostalOffice = {
  Name: string
  District: string
  State: string
  Pincode: string
}

type PostalBlock = {
  Status: string
  PostOffice: PostalOffice[] | null
}

export type PincodeLookupResult = {
  pincode: string
  city: string
  state: string
  areas: string[]
  lat: null
  lng: null
}

/** Pincode → city, state, areas (India Post mirror). */
export async function lookupPincode(pincode: string): Promise<PincodeLookupResult | null> {
  if (!/^\d{6}$/.test(pincode)) return null

  const res = await fetch(`${POSTAL_BASE}/pincode/${pincode}`, {
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  })
  if (!res.ok) return null

  const data = (await res.json()) as PostalBlock[]
  const block = Array.isArray(data) ? data[0] : null
  if (!block || block.Status !== 'Success' || !block.PostOffice?.length) return null

  const offices = block.PostOffice
  const o0 = offices[0]!
  return {
    pincode,
    city: o0.District,
    state: o0.State,
    areas: offices.map((o) => o.Name),
    lat: null,
    lng: null,
  }
}

export type AddressSearchHit = {
  displayName: string
  shortName: string
  lat: number
  lng: number
  pincode: string | null
  city: string | null
  state: string | null
}

function pickCity(addr: Record<string, string | undefined> | undefined): string | null {
  if (!addr) return null
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.district ||
    addr.county ||
    null
  )
}

/** Address text search → suggestions with coordinates (Nominatim). */
export async function searchAddress(query: string, city?: string): Promise<AddressSearchHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const searchQuery = city ? `${q}, ${city}, India` : `${q}, India`

  await throttleNominatim()
  const res = await fetch(
    `${NOMINATIM_BASE}/search?` +
      new URLSearchParams({
        q: searchQuery,
        countrycodes: 'in',
        format: 'json',
        addressdetails: '1',
        limit: '5',
      }),
    {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      next: { revalidate: 0 },
    }
  )
  if (!res.ok) return []

  const results = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    address?: Record<string, string>
  }>

  if (!Array.isArray(results)) return []

  return results.map((r) => {
    const addr = r.address ?? {}
    const pc = addr.postcode?.replace(/\D/g, '').slice(0, 6)
    const pincode = pc && /^\d{6}$/.test(pc) ? pc : null
    const parts = [
      addr.road,
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.village,
      addr.state,
    ].filter(Boolean)
    return {
      displayName: r.display_name,
      shortName: parts.join(', ') || r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      pincode,
      city: pickCity(addr),
      state: addr.state ?? null,
    }
  })
}

export type ReverseGeocodeResult = {
  displayName: string
  pincode: string | null
  city: string | null
  state: string | null
  area: string | null
}

/** Coordinates → address (reverse geocode). */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  await throttleNominatim()
  const res = await fetch(
    `${NOMINATIM_BASE}/reverse?` +
      new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
      }),
    {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      next: { revalidate: 0 },
    }
  )
  if (!res.ok) return null

  const data = (await res.json()) as {
    display_name?: string
    address?: Record<string, string>
  }
  const addr = data.address
  const rawPc = addr?.postcode?.replace(/\D/g, '').slice(0, 6)
  const pincode = rawPc && /^\d{6}$/.test(rawPc) ? rawPc : null

  return {
    displayName: data.display_name ?? '',
    pincode,
    city: addr ? pickCity(addr) : null,
    state: addr?.state ?? null,
    area: addr?.suburb || addr?.neighbourhood || null,
  }
}
