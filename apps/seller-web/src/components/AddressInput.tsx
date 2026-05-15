'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { loadGoogleMapsPlaces } from '../lib/google-maps-loader'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()

export type AddressSearchResolved = {
  displayName: string
  shortName: string
  lat: number
  lng: number
  pincode: string | null
  city: string | null
  state: string | null
}

type Hit = AddressSearchResolved

function parseGooglePlace(place: google.maps.places.PlaceResult): Hit | null {
  const loc = place.geometry?.location
  if (!loc) return null
  const lat = loc.lat()
  const lng = loc.lng()
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const formatted = place.formatted_address?.trim() || place.name?.trim() || ''
  if (!formatted) return null

  const comps = place.address_components ?? []
  let pincode: string | null = null
  let state: string | null = null
  let city: string | null = null
  for (const c of comps) {
    if (c.types.includes('postal_code')) pincode = c.long_name
    if (c.types.includes('administrative_area_level_1')) state = c.long_name
    if (c.types.includes('locality')) city = c.long_name
  }
  if (!city) {
    for (const c of comps) {
      if (
        c.types.includes('sublocality_level_1') ||
        c.types.includes('administrative_area_level_2')
      ) {
        city = c.long_name
        break
      }
    }
  }

  return {
    displayName: formatted,
    shortName: formatted.split(',')[0]?.trim() ?? formatted,
    lat,
    lng,
    pincode,
    city,
    state,
  }
}

export function AddressInput({
  label,
  value,
  onChange,
  cityHint,
  disabled,
  required,
  onResolved,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /** Bias Nominatim search (e.g. current city field). */
  cityHint?: string
  disabled?: boolean
  required?: boolean
  onResolved?: (hit: Hit) => void
}) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const onResolvedRef = useRef(onResolved)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onResolvedRef.current = onResolved
  }, [onResolved])

  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [placesActive, setPlacesActive] = useState(false)
  const [placesLoading, setPlacesLoading] = useState(Boolean(GOOGLE_MAPS_KEY))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    (q: string) => {
      if (placesActive) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const t = q.trim()
      if (t.length < 3) {
        setHits([])
        setOpen(false)
        setEmpty(false)
        return
      }
      debounceRef.current = setTimeout(() => {
        void (async () => {
          setLoading(true)
          setEmpty(false)
          try {
            const params = new URLSearchParams({ q: t })
            const c = cityHint?.trim()
            if (c) params.set('city', c)
            const res = await fetch(`/api/geo/search?${params.toString()}`)
            const json = (await res.json()) as
              | { ok: true; data: { results: Hit[] } }
              | { ok: false; error?: { message?: string } }
            if (!res.ok || !json.ok) {
              setHits([])
              setOpen(false)
              setEmpty(false)
              return
            }
            const list = json.data.results ?? []
            setHits(list)
            setOpen(list.length > 0)
            setEmpty(list.length === 0)
          } catch {
            setHits([])
            setOpen(false)
            setEmpty(false)
          } finally {
            setLoading(false)
          }
        })()
      }, 400)
    },
    [cityHint, placesActive]
  )

  useLayoutEffect(() => {
    if (!GOOGLE_MAPS_KEY || disabled) {
      setPlacesLoading(false)
      setPlacesActive(false)
      return
    }

    const input = inputRef.current
    if (!input) {
      setPlacesLoading(false)
      return
    }

    setPlacesLoading(true)
    let cancelled = false
    let ac: google.maps.places.Autocomplete | null = null

    void loadGoogleMapsPlaces(GOOGLE_MAPS_KEY)
      .then(() => {
        if (cancelled) {
          setPlacesLoading(false)
          return
        }
        if (!inputRef.current || !window.google?.maps?.places) {
          setPlacesLoading(false)
          return
        }
        const el = inputRef.current
        ac = new google.maps.places.Autocomplete(el, {
          componentRestrictions: { country: 'in' },
          fields: ['formatted_address', 'geometry', 'address_components', 'name'],
        })
        ac.addListener('place_changed', () => {
          const place = ac!.getPlace()
          const hit = parseGooglePlace(place)
          if (!hit) return
          onChangeRef.current(hit.displayName)
          onResolvedRef.current?.(hit)
          setHits([])
          setOpen(false)
          setEmpty(false)
        })
        setPlacesActive(true)
        setPlacesLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setPlacesActive(false)
          setPlacesLoading(false)
        } else {
          setPlacesLoading(false)
        }
      })

    return () => {
      cancelled = true
      if (ac && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(ac)
      }
    }
  }, [disabled])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = wrapRef.current
      if (!el || !open) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function pick(h: Hit) {
    setOpen(false)
    setHits([])
    setEmpty(false)
    onChange(h.displayName)
    onResolved?.(h)
  }

  const showList = open && hits.length > 0 && !placesActive
  const hint = placesLoading
    ? 'Google Maps suggestions loading…'
    : placesActive
      ? 'Pick an address from Google suggestions — lat/lng fill automatically.'
      : GOOGLE_MAPS_KEY
        ? 'Google Maps unavailable; using OpenStreetMap search below.'
        : 'Type 3+ characters for OpenStreetMap suggestions. Optional: set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google.'

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        {label}
        <span className="relative">
          <input
            ref={inputRef}
            id={baseId}
            className="w-full rounded-md border bg-background px-2 py-1.5"
            placeholder={placesActive ? 'Start typing an address…' : 'पता टाइप करें...'}
            value={value}
            disabled={disabled}
            required={required}
            autoComplete={placesActive ? 'off' : 'street-address'}
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            onChange={(e) => {
              const v = e.target.value
              onChange(v)
              runSearch(v)
            }}
            onFocus={() => {
              if (hits.length > 0) setOpen(true)
            }}
          />
          {loading && !placesActive && value.trim().length >= 3 ? (
            <span
              className="pointer-events-none absolute end-2 top-1/2 inline-flex size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
              aria-label="खोज रहे हैं..."
            />
          ) : null}
        </span>
      </label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {loading && !placesActive && value.trim().length >= 3 ? (
        <p className="text-xs text-muted-foreground">खोज रहे हैं...</p>
      ) : null}
      {!loading && empty && !placesActive && value.trim().length >= 3 ? (
        <p className="text-xs text-muted-foreground">कोई पता नहीं मिला, मैन्युअल टाइप करें</p>
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {hits.map((h, i) => (
            <li key={`${h.lat}-${h.lng}-${i}`} role="option">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
              >
                <span className="font-medium">{h.shortName || h.displayName}</span>
                <span className="text-xs text-muted-foreground">{h.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
