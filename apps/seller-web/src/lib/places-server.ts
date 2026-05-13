/**
 * Google Places API (New) — server-only. Used from Next route handlers.
 * Enable "Places API (New)" on the key (same project as Geocoding if you reuse the key).
 */

export type PlacesAutocompleteItem = {
  placeId: string
  mainText: string
  secondaryText: string
}

export type PlacesResolvedPlace = {
  formattedAddress: string | null
  pincode: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}

export function resolvePlacesApiKey(): string | undefined {
  const dedicated = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (dedicated) return dedicated
  return process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim()
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
    queryPrediction?: unknown
  }>
  error?: { message?: string; status?: string }
}

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlaceDetailsResponse = {
  id?: string
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: AddressComponent[]
  error?: { message?: string; status?: string }
}

function normalizeIndiaPincode(raw: string | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '').slice(0, 6)
  return /^\d{6}$/.test(d) ? d : null
}

export async function placesAutocompleteNew(
  input: string,
  sessionToken: string
): Promise<PlacesAutocompleteItem[]> {
  const key = resolvePlacesApiKey()
  if (!key) {
    throw new Error('PLACES_NOT_CONFIGURED')
  }
  const trimmed = input.trim()
  if (trimmed.length < 2) return []

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input: trimmed,
      sessionToken,
      includedRegionCodes: ['IN'],
      languageCode: 'en',
      regionCode: 'IN',
    }),
    next: { revalidate: 0 },
  })

  const data = (await res.json()) as AutocompleteResponse
  if (!res.ok) {
    const msg = data.error?.message ?? `Places autocomplete HTTP ${res.status}`
    throw new Error(msg)
  }

  const out: PlacesAutocompleteItem[] = []
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction
    if (!p?.placeId) continue
    const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? p.placeId
    const secondary = p.structuredFormat?.secondaryText?.text ?? ''
    out.push({ placeId: p.placeId, mainText: main, secondaryText: secondary })
    if (out.length >= 8) break
  }
  return out
}

function parsePlaceDetails(place: PlaceDetailsResponse): PlacesResolvedPlace {
  let pincode: string | null = null
  let city: string | null = null
  let state: string | null = null

  for (const c of place.addressComponents ?? []) {
    const types = c.types ?? []
    if (types.includes('postal_code')) {
      pincode = normalizeIndiaPincode(c.longText ?? c.shortText) ?? pincode
    }
    if (types.includes('locality')) {
      city = city ?? c.longText ?? null
    }
    if (types.includes('administrative_area_level_2') && !city) {
      city = c.longText ?? null
    }
    if (types.includes('administrative_area_level_1')) {
      state = c.longText ?? null
    }
  }

  const lat = place.location?.latitude
  const lng = place.location?.longitude

  return {
    formattedAddress: place.formattedAddress ?? null,
    pincode,
    city,
    state,
    lat: lat != null && Number.isFinite(lat) ? lat : null,
    lng: lng != null && Number.isFinite(lng) ? lng : null,
  }
}

export async function placesGetDetailsNew(
  placeId: string,
  sessionToken: string
): Promise<PlacesResolvedPlace> {
  const key = resolvePlacesApiKey()
  if (!key) {
    throw new Error('PLACES_NOT_CONFIGURED')
  }
  const id = encodeURIComponent(placeId)
  const url = new URL(`https://places.googleapis.com/v1/places/${id}`)
  url.searchParams.set('sessionToken', sessionToken)
  url.searchParams.set('languageCode', 'en')
  url.searchParams.set('regionCode', 'IN')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
    },
    next: { revalidate: 0 },
  })

  const place = (await res.json()) as PlaceDetailsResponse
  if (!res.ok) {
    const msg = place.error?.message ?? `Places details HTTP ${res.status}`
    throw new Error(msg)
  }

  return parsePlaceDetails(place)
}
