'use client'

import { ApiError, apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AddressInput } from '../../../../components/AddressInput'
import { PincodeInput } from '../../../../components/PincodeInput'
import type { PincodeLookupPayload } from '../../../../hooks/usePincodeLookup'

/** Demo PINs used in DB seed examples — booking no longer fails if a PIN is missing from the directory. */
const DEMO_PINCODES =
  'Bengaluru 560001, 560103 · Mumbai 400001, 400053 — any valid 6-digit PIN can be booked.'

type BookingSuccess = {
  order: { publicId: string; id: string }
  shipment: { trackingNumber: string | null; trackingPublicId: string }
  summary: { publicId: string; trackingNumber: string | null; trackingPublicId: string }
  qrDataUrl?: string
  otpConfirmationMessage?: string
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as {
      error?: { message?: string; details?: unknown }
    } | null
    const base = err.message
    const det = body?.error?.details
    if (det != null) {
      try {
        return `${base} · ${JSON.stringify(det)}`
      } catch {
        return base
      }
    }
    return base
  }
  if (err instanceof Error) return err.message
  return 'Booking failed'
}

export default function NewShipmentPage() {
  const router = useRouter()
  const errorRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<BookingSuccess | null>(null)
  const [form, setForm] = useState({
    customerName: 'Demo Customer',
    customerPhone: '9876543210',
    productName: 'Demo parcel',
    weightGrams: 500,
    productValue: 0,
    pickupAddress: 'Pickup address, Bengaluru',
    pickupLat: '' as string,
    pickupLng: '' as string,
    pickupCity: '',
    pickupState: '',
    pickupArea: '',
    deliveryAddress: 'Delivery address, Bengaluru',
    deliveryLat: undefined as number | undefined,
    deliveryLng: undefined as number | undefined,
    pickupPincode: '560001',
    deliveryPincode: '560103',
    deliveryCity: '',
    deliveryState: '',
    deliveryArea: '',
    orderType: 'LOCAL_DELIVERY' as 'LOCAL_DELIVERY' | 'BUS_PARCEL',
  })

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const pickupLat =
        form.pickupLat.trim() === '' ? undefined : Number(form.pickupLat)
      const pickupLng =
        form.pickupLng.trim() === '' ? undefined : Number(form.pickupLng)
      if (
        form.pickupLat.trim() !== '' &&
        (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng))
      ) {
        setError(
          'Pickup latitude and longitude must both be valid numbers, or leave both blank.'
        )
        return
      }

      const res = await apiFetch<{ ok: boolean; data: BookingSuccess }>('/api/v1/orders', {
        method: 'POST',
        body: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          productName: form.productName,
          productWeight: form.weightGrams / 1000,
          productValue: form.productValue,
          pickupAddress: [form.pickupAddress, form.pickupArea].map((s) => s.trim()).filter(Boolean).join(', '),
          pickupLat,
          pickupLng,
          pickupPincode: form.pickupPincode,
          pickupCity: form.pickupCity.trim() || undefined,
          pickupArea: form.pickupArea.trim() || undefined,
          deliveryAddress: [form.deliveryAddress, form.deliveryArea].map((s) => s.trim()).filter(Boolean).join(', '),
          deliveryLat: form.deliveryLat,
          deliveryLng: form.deliveryLng,
          deliveryPincode: form.deliveryPincode,
          deliveryCity: form.deliveryCity.trim() || undefined,
          deliveryArea: form.deliveryArea.trim() || undefined,
          orderType: form.orderType,
        },
      })
      setSuccess(res.data)
    } catch (err: unknown) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const trackRef =
      success.shipment?.trackingNumber ??
      success.shipment?.trackingPublicId ??
      success.order.publicId
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 pb-8 sm:pb-10">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Shipment booked</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/shipments">All shipments</Link>
          </Button>
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">Order ID</p>
          <p className="mt-1 font-mono text-base font-semibold">{success.order.publicId}</p>
          {success.shipment?.trackingNumber ? (
            <>
              <p className="mt-3 text-muted-foreground">Tracking number</p>
              <p className="mt-1 font-mono">{success.shipment.trackingNumber}</p>
            </>
          ) : null}
          {success.otpConfirmationMessage ? (
            <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-primary">
              {success.otpConfirmationMessage}
            </p>
          ) : null}
        </div>
        {success.qrDataUrl ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
            <p className="text-sm font-medium">Scan QR (customer / hub)</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={success.qrDataUrl}
              alt="Order QR code"
              width={256}
              height={256}
              className="rounded-lg border bg-white p-2"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => router.push(`/dashboard/tracking/${success.order.publicId}`)}
          >
            Open in dashboard
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href={`/track/${encodeURIComponent(trackRef)}`}>Public tracking link</Link>
          </Button>
          <Button variant="ghost" type="button" onClick={() => setSuccess(null)}>
            Book another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-8 sm:pb-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Create shipment</h1>
        <Button variant="outline" asChild size="sm">
          <Link href="/dashboard/shipments">Back</Link>
        </Button>
      </div>
      {error ? (
        <div
          ref={errorRef}
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Demo PINs (seeded): {DEMO_PINCODES}
      </p>
      <p className="text-xs text-muted-foreground">
        पिनकोड: India Post (मुफ्त)। पता: OpenStreetMap या (Vercel पर{' '}
        <code className="text-[11px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> हो तो) Google Places — चुनने पर
        lat/lng ऑटो भरते हैं। © OpenStreetMap योगदानकर्ता
      </p>
      <form className="flex flex-col gap-3 text-sm" onSubmit={submit}>
        <Field label="Customer name" v={form.customerName} onV={(v) => setForm({ ...form, customerName: v })} />
        <Field label="Customer phone" v={form.customerPhone} onV={(v) => setForm({ ...form, customerPhone: v })} />
        <Field label="Product name" v={form.productName} onV={(v) => setForm({ ...form, productName: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Num label="Weight (grams)" value={form.weightGrams} onChange={(n) => setForm({ ...form, weightGrams: n })} />
          <Num
            label="Declared value (INR)"
            value={form.productValue}
            onChange={(n) => setForm({ ...form, productValue: n })}
          />
        </div>
        <label className="flex flex-col gap-1">
          Order type
          <select
            className="rounded-md border bg-background px-2 py-1.5"
            value={form.orderType}
            onChange={(e) =>
              setForm({
                ...form,
                orderType: e.target.value as 'LOCAL_DELIVERY' | 'BUS_PARCEL',
              })
            }
          >
            <option value="LOCAL_DELIVERY">Local delivery</option>
            <option value="BUS_PARCEL">Bus parcel</option>
          </select>
        </label>
        <PincodeInput
          id="pickup-pin"
          fieldLabel="पिकअप पिनकोड"
          value={form.pickupPincode}
          onChange={(v) => setForm({ ...form, pickupPincode: v })}
          onPincodeResolved={(p: PincodeLookupPayload) =>
            setForm((f) => ({
              ...f,
              pickupPincode: p.pincode,
              pickupCity: p.city,
              pickupState: p.state,
            }))
          }
        />
        <Field label="Pickup city" v={form.pickupCity} onV={(v) => setForm((f) => ({ ...f, pickupCity: v }))} />
        <Field label="Pickup state" v={form.pickupState} onV={(v) => setForm((f) => ({ ...f, pickupState: v }))} />
        <AddressInput
          label="Pickup address"
          value={form.pickupAddress}
          onChange={(v) => setForm((f) => ({ ...f, pickupAddress: v }))}
          cityHint={form.pickupCity}
          disabled={loading}
          required
          onResolved={(h) =>
            setForm((f) => ({
              ...f,
              pickupAddress: h.displayName,
              pickupPincode: h.pincode ?? f.pickupPincode,
              pickupLat: Number.isFinite(h.lat) ? String(h.lat) : f.pickupLat,
              pickupLng: Number.isFinite(h.lng) ? String(h.lng) : f.pickupLng,
              pickupCity: h.city ?? f.pickupCity,
              pickupState: h.state ?? f.pickupState,
            }))
          }
        />
        <Field
          optional
          label="क्षेत्र / locality (पिकअप, वैकल्पिक)"
          v={form.pickupArea}
          onV={(v) => setForm((f) => ({ ...f, pickupArea: v }))}
        />
        <PincodeInput
          id="delivery-pin"
          fieldLabel="डिलीवरी पिनकोड"
          value={form.deliveryPincode}
          onChange={(v) => setForm({ ...form, deliveryPincode: v })}
          onPincodeResolved={(p: PincodeLookupPayload) =>
            setForm((f) => ({
              ...f,
              deliveryPincode: p.pincode,
              deliveryCity: p.city,
              deliveryState: p.state,
            }))
          }
        />
        <Field label="Delivery city" v={form.deliveryCity} onV={(v) => setForm((f) => ({ ...f, deliveryCity: v }))} />
        <Field
          label="Delivery state"
          v={form.deliveryState}
          onV={(v) => setForm((f) => ({ ...f, deliveryState: v }))}
        />
        <AddressInput
          label="Delivery address"
          value={form.deliveryAddress}
          onChange={(v) => setForm((f) => ({ ...f, deliveryAddress: v }))}
          cityHint={form.deliveryCity}
          disabled={loading}
          required
          onResolved={(h) =>
            setForm((f) => ({
              ...f,
              deliveryAddress: h.displayName,
              deliveryPincode: h.pincode ?? f.deliveryPincode,
              deliveryLat: Number.isFinite(h.lat) ? h.lat : f.deliveryLat,
              deliveryLng: Number.isFinite(h.lng) ? h.lng : f.deliveryLng,
              deliveryCity: h.city ?? f.deliveryCity,
              deliveryState: h.state ?? f.deliveryState,
            }))
          }
        />
        <Field
          optional
          label="क्षेत्र / locality (डिलीवरी, वैकल्पिक)"
          v={form.deliveryArea}
          onV={(v) => setForm((f) => ({ ...f, deliveryArea: v }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            optional
            label="Pickup lat (optional)"
            v={form.pickupLat}
            onV={(v) => setForm({ ...form, pickupLat: v })}
            placeholder="12.9716"
            inputMode="decimal"
          />
          <Field
            optional
            label="Pickup lng (optional)"
            v={form.pickupLng}
            onV={(v) => setForm({ ...form, pickupLng: v })}
            placeholder="77.5946"
            inputMode="decimal"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          पता चुनने पर ऊपर से भर जाता है; खाली या दशमलव संख्या — दोनों खाली छोड़ सकते हो।
        </p>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? 'Booking…' : 'Book shipment'}
        </Button>
      </form>
    </div>
  )
}

function Field({
  label,
  v,
  onV,
  optional,
  placeholder,
  inputMode,
}: {
  label: string
  v: string
  onV: (s: string) => void
  optional?: boolean
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        className="rounded-md border bg-background px-2 py-1.5"
        value={v}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onV(e.target.value)}
        required={!optional}
      />
    </label>
  )
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        type="number"
        step="any"
        className="rounded-md border bg-background px-2 py-1.5"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        required
      />
    </label>
  )
}
