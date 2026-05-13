'use client'

import { Button } from '@repo/ui'
import { useEffect, useState } from 'react'
import { workerFetch } from '../../lib/worker-api'
import { readWorkerId } from '../../lib/worker-session'

type W = {
  displayName: string
  phone: string | null
  role: string
  isVerified: boolean
  address: string | null
  city: string | null
  pincode: string | null
  vehicleType: string | null
  vehicleNumber: string | null
  upiId: string | null
  bankAccount: string | null
  bankIfsc: string | null
  photoUrl: string | null
  aadhaarPhotoUrl: string | null
  drivingLicenseUrl: string | null
  todayEarnings: number
  monthEarnings: number
}

export default function ProfilePage() {
  const id = readWorkerId()
  const [w, setW] = useState<W | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const p = await workerFetch<W>(`/workers/${id}/profile`)
        setW(p)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed')
      }
    })()
  }, [id])

  if (!id) return <p className="p-4 text-sm">Login required.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
      {w ? (
        <>
          <div className="flex items-center gap-3">
            <div
              className="size-20 rounded-full bg-muted bg-cover bg-center"
              style={w.photoUrl ? { backgroundImage: `url(${w.photoUrl})` } : undefined}
            />
            <div>
              <p className="font-semibold">{w.displayName}</p>
              <p className="text-sm text-muted-foreground">{w.phone}</p>
              <p className="text-xs uppercase text-violet-600">{w.role}</p>
              <p className="text-xs">
                {w.isVerified ? (
                  <span className="text-emerald-600">Verified</span>
                ) : (
                  <span className="text-amber-600">Pending verification</span>
                )}
              </p>
            </div>
          </div>
          <section className="rounded-xl border p-4 text-sm">
            <p className="font-medium">Personal</p>
            <p className="text-muted-foreground">{w.address}</p>
            <p>
              {w.city} {w.pincode}
            </p>
          </section>
          <section className="rounded-xl border p-4 text-sm">
            <p className="font-medium">Vehicle</p>
            <p>
              {w.vehicleType} · {w.vehicleNumber}
            </p>
          </section>
          <section className="rounded-xl border p-4 text-sm">
            <p className="font-medium">Payment</p>
            <p>UPI: {w.upiId ?? '—'}</p>
            <p>
              Bank: {w.bankAccount ? `${w.bankAccount.slice(0, 4)}…` : '—'} {w.bankIfsc}
            </p>
          </section>
          <section className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-lg border p-2">
              <p className="text-muted-foreground">Today</p>
              <p className="font-bold">₹{w.todayEarnings?.toFixed(0)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-muted-foreground">Month</p>
              <p className="font-bold">₹{w.monthEarnings?.toFixed(0)}</p>
            </div>
          </section>
          {w.aadhaarPhotoUrl ? (
            <a
              href={w.aadhaarPhotoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              View Aadhaar photo
            </a>
          ) : null}
          {w.drivingLicenseUrl ? (
            <a
              href={w.drivingLicenseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              View licence photo
            </a>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      <Button variant="outline" asChild className="w-full">
        <a href="/dashboard">Back</a>
      </Button>
    </div>
  )
}
