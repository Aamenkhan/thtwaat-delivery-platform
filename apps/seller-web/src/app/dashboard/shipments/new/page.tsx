'use client'

import { ApiError, apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/** Must match `PincodeDirectory` seed rows or booking returns 404. */
const DEMO_PINCODES =
  'Bengaluru 560001, 560103 · Mumbai 400001, 400053. Other 6-digit PINs must exist in the DB seed (Delhi 11xxxx not seeded by default).'

export default function NewShipmentPage() {
  const router = useRouter()
  const errorRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    customerName: 'Demo Customer',
    customerPhone: '9876543210',
    pickupAddress: 'Pickup address, Bengaluru',
    deliveryAddress: 'Delivery address, Bengaluru',
    deliveryLat: 12.97,
    deliveryLng: 77.59,
    parcelType: 'PARCEL' as const,
    weightGrams: 500,
    codAmount: 0,
    pickupPincode: '560001',
    /** Must exist in DB seed (`PincodeDirectory`) — 560001 / 560103 are Bengaluru demo rows. */
    deliveryPincode: '560103',
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
    try {
      const res = await apiFetch<{
        data: { summary: { publicId: string } }
      }>('/v1/seller/shipments', {
        method: 'POST',
        body: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          pickupAddress: form.pickupAddress,
          deliveryAddress: form.deliveryAddress,
          deliveryLat: form.deliveryLat,
          deliveryLng: form.deliveryLng,
          parcelType: form.parcelType,
          weight: { grams: form.weightGrams },
          codAmount: form.codAmount,
          pickupPincode: form.pickupPincode,
          deliveryPincode: form.deliveryPincode,
        },
      })
      router.push(`/dashboard/tracking/${res.data.summary.publicId}`)
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Booking failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
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
      <form className="flex flex-col gap-3 text-sm" onSubmit={submit}>
        <Field label="Customer name" v={form.customerName} onV={(v) => setForm({ ...form, customerName: v })} />
        <Field label="Customer phone" v={form.customerPhone} onV={(v) => setForm({ ...form, customerPhone: v })} />
        <Field label="Pickup address" v={form.pickupAddress} onV={(v) => setForm({ ...form, pickupAddress: v })} />
        <Field
          label="Delivery address"
          v={form.deliveryAddress}
          onV={(v) => setForm({ ...form, deliveryAddress: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Num label="Delivery lat" value={form.deliveryLat} onChange={(n) => setForm({ ...form, deliveryLat: n })} />
          <Num label="Delivery lng" value={form.deliveryLng} onChange={(n) => setForm({ ...form, deliveryLng: n })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pickup PIN" v={form.pickupPincode} onV={(v) => setForm({ ...form, pickupPincode: v })} />
          <Field
            label="Delivery PIN"
            v={form.deliveryPincode}
            onV={(v) => setForm({ ...form, deliveryPincode: v })}
          />
        </div>
        <Num label="Weight (grams)" value={form.weightGrams} onChange={(n) => setForm({ ...form, weightGrams: n })} />
        <Num label="COD (INR)" value={form.codAmount} onChange={(n) => setForm({ ...form, codAmount: n })} />
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
}: {
  label: string
  v: string
  onV: (s: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        className="rounded-md border bg-background px-2 py-1.5"
        value={v}
        onChange={(e) => onV(e.target.value)}
        required
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
