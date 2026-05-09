import { Button } from '@repo/ui'
import type { SellerDashboardSummary } from '@repo/types'

async function loadSummary(): Promise<SellerDashboardSummary | null> {
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const token = process.env.SELLER_API_KEY
  if (!token) return null

  const res = await fetch(`${base}/v1/orders/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = (await res.json()) as {
    data?: { summary: SellerDashboardSummary }
  }
  return body.data?.summary ?? null
}

export default async function SellerDashboardPage() {
  const summary = await loadSummary()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Modular monolith · Seller view</p>
        <h1 className="text-3xl font-semibold tracking-tight">Seller dashboard</h1>
        <p className="max-w-2xl text-muted-foreground">
          Track open shipments, delivery performance, and returns from a single
          operations surface.
        </p>
      </header>

      {!summary ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5">SELLER_API_KEY</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">API_INTERNAL_URL</code> in{' '}
          <code className="rounded bg-muted px-1 py-0.5">apps/seller-web/.env.local</code>{' '}
          to load live metrics.
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Open orders" value={summary.openOrders} />
          <MetricCard label="Delivered (7d)" value={summary.deliveredThisWeek} />
          <MetricCard label="Returns pending" value={summary.returnsPending} />
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
