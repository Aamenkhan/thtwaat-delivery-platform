'use client'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FadeIn,
  KpiCard,
  PageHeader,
  StatusBadge,
} from '@repo/ui'
import { MapPin, Radio, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function WorkerHome() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader
          title="Field control"
          description="Routes, scans, OTP handoffs, and proof — optimized for one-thumb flows in sunlight."
        />
      </FadeIn>

      {!online ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50"
          role="status"
        >
          <WifiOff className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Offline</p>
            <p className="text-xs opacity-90">Scans queue when connectivity returns (wire your offline store).</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-900 dark:text-emerald-100">
          <Radio className="size-3.5" aria-hidden />
          Live · connected
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Today&apos;s runs" value="6 stops" hint="Demo route density" icon={MapPin} />
        <KpiCard label="Earnings (demo)" value="₹1,240" hint="After hub incentives" variant="glass" />
        <KpiCard label="SLA" value="98%" hint="On-time first attempt" />
      </section>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-base">Next actions</CardTitle>
          <CardDescription>Typical shift flow</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild>
            <Link href="/dashboard/routes">Open routes</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/scan">Scan QR</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/otp">OTP verify</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Demo assignment</CardTitle>
          <StatusBadge tone="info">In progress</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">BLR-HUB-04 → Indiranagar</span> · 3 COD · 2 prepaid
          </p>
          <p className="text-xs">Use proof photo after OTP success for high-value parcels.</p>
        </CardContent>
      </Card>
    </div>
  )
}
