import { Button } from '@repo/ui'
import type { HubDashboardSummary } from '@repo/types'

async function loadSummary(): Promise<HubDashboardSummary | null> {
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const token = process.env.HUB_API_KEY
  if (!token) return null

  const res = await fetch(`${base}/v1/hubs/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = (await res.json()) as { data?: { summary: HubDashboardSummary } }
  return body.data?.summary ?? null
}

export default async function HubDashboardPage() {
  const summary = await loadSummary()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Modular monolith · Hub view</p>
        <h1 className="text-3xl font-semibold tracking-tight">Hub dashboard</h1>
        <p className="max-w-2xl text-muted-foreground">
          Inbound and outbound scans, exceptions, and live parcel flow for your hub
          operations team.
        </p>
      </header>

      {!summary ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5">HUB_API_KEY</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">API_INTERNAL_URL</code> in{' '}
          <code className="rounded bg-muted px-1 py-0.5">apps/admin-web/.env.local</code>{' '}
          to load live metrics.
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Inbound today" value={summary.inboundToday} />
          <MetricCard label="Outbound today" value={summary.outboundToday} />
          <MetricCard label="Exceptions" value={summary.exceptions} />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href="/">Refresh view</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}>
            Open API
          </a>
        </Button>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}
