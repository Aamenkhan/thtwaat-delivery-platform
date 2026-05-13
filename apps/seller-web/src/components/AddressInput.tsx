'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

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
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    (q: string) => {
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
    [cityHint]
  )

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

  const showList = open && hits.length > 0

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        {label}
        <span className="relative">
          <input
            id={baseId}
            className="w-full rounded-md border bg-background px-2 py-1.5"
            placeholder="पता टाइप करें..."
            value={value}
            disabled={disabled}
            required={required}
            autoComplete="street-address"
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
          {loading ? (
            <span
              className="pointer-events-none absolute end-2 top-1/2 inline-flex size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
              aria-label="खोज रहे हैं..."
            />
          ) : null}
        </span>
      </label>
      {loading && value.trim().length >= 3 ? (
        <p className="text-xs text-muted-foreground">खोज रहे हैं...</p>
      ) : null}
      {!loading && empty && value.trim().length >= 3 ? (
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
