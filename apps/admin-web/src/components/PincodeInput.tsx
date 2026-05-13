'use client'

import { usePincodeLookup, type PincodeLookupPayload } from '../hooks/usePincodeLookup'
import { useEffect, useRef, useState } from 'react'

export type PincodeInputProps = {
  id?: string
  fieldLabel?: string
  value: string
  onChange: (pincode: string) => void
  onPincodeResolved?: (payload: PincodeLookupPayload) => void
  disabled?: boolean
}

export function PincodeInput({
  id,
  fieldLabel,
  value,
  onChange,
  onPincodeResolved,
  disabled,
}: PincodeInputProps) {
  const { lookup, loading, areas, error, reset } = usePincodeLookup()
  const [successCity, setSuccessCity] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<string | null>(null)
  const [areaIndex, setAreaIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResolvedRef = useRef<string | null>(null)
  const onPincodeResolvedRef = useRef(onPincodeResolved)
  onPincodeResolvedRef.current = onPincodeResolved

  const cancelLookupRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const digits = value.replace(/\D/g, '').slice(0, 6)
    if (digits.length !== 6) {
      reset()
      setSuccessCity(null)
      setSuccessState(null)
      lastResolvedRef.current = null
      return
    }
    cancelLookupRef.current = false
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const r = await lookup(digits)
        if (cancelLookupRef.current) return
        if (!r) {
          setSuccessCity(null)
          setSuccessState(null)
          lastResolvedRef.current = null
          return
        }
        setSuccessCity(r.city)
        setSuccessState(r.state)
        setAreaIndex(0)
        const area = r.areas[0] ?? ''
        const payload: PincodeLookupPayload = {
          pincode: digits,
          city: r.city,
          state: r.state,
          area,
        }
        lastResolvedRef.current = `${digits}:${area}`
        onPincodeResolvedRef.current?.(payload)
      })()
    }, 300)
    return () => {
      cancelLookupRef.current = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, lookup, reset])

  useEffect(() => {
    if (!successCity || !areas.length) return
    const digits = value.replace(/\D/g, '').slice(0, 6)
    if (digits.length !== 6) return
    const area = areas[areaIndex] ?? areas[0] ?? ''
    const key = `${digits}:${area}`
    if (lastResolvedRef.current === key) return
    lastResolvedRef.current = key
    onPincodeResolvedRef.current?.({
      pincode: digits,
      city: successCity,
      state: successState ?? '',
      area,
    })
  }, [areaIndex, areas, successCity, successState, value])

  const showError = Boolean(error) && value.length === 6 && !loading
  const showSuccess = Boolean(successCity && successState && !error && !loading)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
        <span className="text-foreground">{fieldLabel ?? 'पिनकोड'}</span>
        <span className="relative flex items-center">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            pattern="\d{6}"
            placeholder="पिनकोड डालें"
            className="w-full rounded-md border bg-background py-1.5 pe-9 ps-2 font-mono text-sm tracking-widest"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              onChange(v)
            }}
          />
          {loading ? (
            <span
              className="pointer-events-none absolute end-2 inline-flex size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
              aria-label="लोड हो रहा है"
            />
          ) : showSuccess ? (
            <span className="absolute end-2 text-lg text-emerald-600" aria-hidden>
              ✓
            </span>
          ) : null}
        </span>
      </label>
      {loading && value.length === 6 ? (
        <p className="text-xs text-muted-foreground">जानकारी लोड हो रही है...</p>
      ) : null}
      {showError ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          गलत पिनकोड, दोबारा डालें
        </p>
      ) : null}
      {showSuccess ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          📍 {successCity}, {successState}
        </p>
      ) : null}
      {areas.length > 1 && showSuccess ? (
        <label className="flex flex-col gap-1 text-sm">
          <span>क्षेत्र चुनें</span>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={areaIndex}
            onChange={(e) => setAreaIndex(Number(e.target.value))}
          >
            {areas.map((a, i) => (
              <option key={`${a}-${i}`} value={i}>
                {a}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
