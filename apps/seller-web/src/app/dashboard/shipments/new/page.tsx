'use client'

import { ApiError, apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { GeocodePincodeButton } from '../../../../components/GeocodePincodeButton'
import { PincodeInput } from '../../../../components/PincodeInput'
import type { PincodeLookupPayload } from '../../../../hooks/usePincodeLookup'

/** Must match `PincodeDirectory` seed rows or booking returns 404. */
const DEMO_PINCODES =
  'Bengaluru 560001, 560103 · Mumbai 400001, 400053. Other 6-digit PINs must exist in the DB seed (Delhi 11xxxx not seeded by default).'

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
    deliveryAddress: 'Delivery address, Bengaluru',
    deliveryLat: 12.97,
    deliveryLng: 77.59,
    pickupPincode: '560001',
    /** Must exist in DB seed (`PincodeDirectory`) — 560001 / 560103 are Bengaluru demo rows. */
    deliveryPincode: '560103',
    deliveryCity: '',
    deliveryState: '',
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
          pickupAddress: form.pickupAddress,
          pickupLat,
          pickupLng,
          pickupPincode: form.pickupPincode,
          deliveryAddress: form.deliveryAddress,
          deliveryLat: form.deliveryLat,
          deliveryLng: form.deliveryLng,
          deliveryPincode: form.deliveryPincode,
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
        पिनकोड (6 अंक) डालने पर शहर/राज्य ऑटो आते हैं; पूरे पते से पिनकोड अभी अपने आप नहीं आता — नीचे पते के नीचे वाला बटन दबाएँ। बुकिंग के लिए वह PIN प्लेटफ़ॉर्म की सूची में होना चाहिए (नीचे डेमो PIN या DB seed)।
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
        {form.pickupCity ? (
          <p className="text-xs text-muted-foreground">
            शहर: {form.pickupCity} · राज्य: {form.pickupState}
          </p>
        ) : null}
        <Field label="Pickup address" v={form.pickupAddress} onV={(v) => setForm({ ...form, pickupAddress: v })} />
        <GeocodePincodeButton
          address={form.pickupAddress}
          disabled={loading}
          contextLabel="पिकअप"
          onResolved={(r) =>
            setForm((f) => ({
              ...f,
              pickupPincode: r.pincode ?? f.pickupPincode,
              pickupLat: r.lat != null ? String(r.lat) : f.pickupLat,
              pickupLng: r.lng != null ? String(r.lng) : f.pickupLng,
            }))
          }
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
              deliveryAddress: `${p.area}, ${p.city}, ${p.state}`,
            }))
          }
        />
        {form.deliveryCity ? (
          <p className="text-xs text-muted-foreground">
            शहर: {form.deliveryCity} · राज्य: {form.deliveryState}
          </p>
        ) : null}
        <Field
          label="Delivery address"
          v={form.deliveryAddress}
          onV={(v) => setForm({ ...form, deliveryAddress: v })}
        />
        <GeocodePincodeButton
          address={form.deliveryAddress}
          disabled={loading}
          contextLabel="डिलीवरी"
          onResolved={(r) =>
            setForm((f) => ({
              ...f,
              deliveryPincode: r.pincode ?? f.deliveryPincode,
              deliveryLat: r.lat ?? f.deliveryLat,
              deliveryLng: r.lng ?? f.deliveryLng,
            }))
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Num label="Delivery lat" value={form.deliveryLat} onChange={(n) => setForm({ ...form, deliveryLat: n })} />
          <Num label="Delivery lng" value={form.deliveryLng} onChange={(n) => setForm({ ...form, deliveryLng: n })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            optional
            label="Pickup lat (optional)"
            v={form.pickupLat}
            onV={(v) => setForm({ ...form, pickupLat: v })}
          />
          <Field
            optional
            label="Pickup lng (optional)"
            v={form.pickupLng}
            onV={(v) => setForm({ ...form, pickupLng: v })}
          />
        </div>
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
}: {
  label: string
  v: string
  onV: (s: string) => void
  optional?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        className="rounded-md border bg-background px-2 py-1.5"
        value={v}
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
