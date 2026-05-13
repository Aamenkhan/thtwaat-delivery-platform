'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type PlacesResolvedPlacePayload = {
  formattedAddress: string | null
  pincode: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}

type Suggestion = { placeId: string; mainText: string; secondaryText: string }

type ConfigRes = { ok: true; data: { placesAutocompleteEnabled: boolean } }

export function PlacesAddressAutocomplete({
  label,
  value,
  onChange,
  onPlaceResolved,
  disabled,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onPlaceResolved?: (p: PlacesResolvedPlacePayload) => void
  disabled?: boolean
  required?: boolean
}) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const wrapRef = useRef<HTMLDivElement>(null)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const [placesEnabled, setPlacesEnabled] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingPick, setLoadingPick] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/places-config')
        const json = (await res.json()) as ConfigRes
        if (!cancelled && json.ok) {
          setPlacesEnabled(json.data.placesAutocompleteEnabled)
        }
      } catch {
        if (!cancelled) setPlacesEnabled(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runAutocomplete = useCallback(
    (q: string) => {
      if (placesEnabled !== true || q.trim().length < 2) {
        setSuggestions([])
        setOpen(false)
        return
      }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void (async () => {
          setLoadingList(true)
          try {
            const res = await fetch('/api/places-autocomplete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ input: q, sessionToken }),
            })
            const json = (await res.json()) as
              | { ok: true; data: { suggestions: Suggestion[] } }
              | { ok: false; error?: { message?: string } }
            if (!res.ok || !json.ok) {
              setSuggestions([])
              setOpen(false)
              return
            }
            setSuggestions(json.data.suggestions)
            setOpen(json.data.suggestions.length > 0)
          } catch {
            setSuggestions([])
            setOpen(false)
          } finally {
            setLoadingList(false)
          }
        })()
      }, 280)
    },
    [placesEnabled, sessionToken]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current
      if (!el || !open) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  async function pickSuggestion(s: Suggestion) {
    setOpen(false)
    setSuggestions([])
    if (!onPlaceResolved) {
      onChange(s.mainText + (s.secondaryText ? `, ${s.secondaryText}` : ''))
      setSessionToken(crypto.randomUUID())
      return
    }
    setLoadingPick(true)
    try {
      const res = await fetch('/api/places-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: s.placeId, sessionToken }),
      })
      const json = (await res.json()) as
        | { ok: true; data: { place: PlacesResolvedPlacePayload } }
        | { ok: false; error?: { message?: string } }
      if (res.ok && json.ok) {
        const p = json.data.place
        if (p.formattedAddress) onChange(p.formattedAddress)
        onPlaceResolved(p)
      } else {
        onChange(s.mainText + (s.secondaryText ? `, ${s.secondaryText}` : ''))
      }
    } catch {
      onChange(s.mainText + (s.secondaryText ? `, ${s.secondaryText}` : ''))
    } finally {
      setLoadingPick(false)
      setSessionToken(crypto.randomUUID())
    }
  }

  const showDropdown = open && suggestions.length > 0 && placesEnabled === true
  const hint =
    placesEnabled === false
      ? 'Google Places: सर्वर पर GOOGLE_PLACES_API_KEY (या Geocoding वाली key पर Places API New चालू) सेट करें।'
      : placesEnabled === true
        ? 'टाइप करते समय सुझाव — सूची से पता चुनें (पिनकोड / नक्शा भरने में मदद)।'
        : null

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        {label}
        <span className="relative">
          <input
            id={baseId}
            className="w-full rounded-md border bg-background px-2 py-1.5"
            value={value}
            disabled={disabled || loadingPick}
            required={required}
            autoComplete="street-address"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            aria-autocomplete={placesEnabled === true ? 'list' : undefined}
            role={placesEnabled === true ? 'combobox' : undefined}
            onChange={(e) => {
              const v = e.target.value
              onChange(v)
              runAutocomplete(v)
            }}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true)
            }}
          />
          {loadingList ? (
            <span className="pointer-events-none absolute end-2 top-1/2 inline-flex size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          ) : null}
        </span>
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {showDropdown ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((s) => (
            <li key={s.placeId} role="option">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pickSuggestion(s)}
              >
                <span className="font-medium">{s.mainText}</span>
                {s.secondaryText ? (
                  <span className="text-xs text-muted-foreground">{s.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
