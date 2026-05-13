'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useQuery } from '@tanstack/react-query'

type Store = {
  id: string
  provider: string
  externalId: string
  displayName: string | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  status: string
  createdAt: string
}

type Job = {
  id: string
  type: string
  status: string
  attempts: number
  lastError: string | null
  runAfter: string | null
  storeId: string | null
  createdAt: string
  updatedAt: string
}

export default function IntegrationsPage() {
  const storesQ = useQuery({
    queryKey: ['seller', 'integrations', 'stores'],
    queryFn: () =>
      apiFetch<{ data: { stores: Store[] } }>('/v1/seller/integrations/stores'),
  })

  const jobsQ = useQuery({
    queryKey: ['seller', 'integrations', 'jobs'],
    queryFn: () =>
      apiFetch<{ data: { jobs: Job[] } }>('/v1/seller/integrations/jobs?limit=40'),
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected stores and recent sync jobs from{' '}
          <code className="rounded bg-muted px-1">GET /v1/seller/integrations/*</code>
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Connected stores</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={storesQ.isFetching}
            onClick={() => void storesQ.refetch()}
          >
            Refresh
          </Button>
        </div>
        {storesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : storesQ.isError ? (
          <p className="text-sm text-destructive">Could not load stores.</p>
        ) : (storesQ.data?.data.stores?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No connected stores yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {(storesQ.data?.data.stores ?? []).map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{s.displayName ?? s.externalId}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.provider} · {s.status}
                  {s.lastSyncAt ? ` · last sync ${new Date(s.lastSyncAt).toLocaleString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={jobsQ.isFetching}
            onClick={() => void jobsQ.refetch()}
          >
            Refresh
          </Button>
        </div>
        {jobsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobsQ.isError ? (
          <p className="text-sm text-destructive">Could not load jobs.</p>
        ) : (jobsQ.data?.data.jobs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No integration jobs yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {(jobsQ.data?.data.jobs ?? []).map((j) => (
              <li key={j.id} className="px-4 py-3 text-sm">
                <p className="font-mono text-xs">{j.id}</p>
                <p className="mt-1">
                  <span className="font-medium">{j.type}</span>
                  <span className="text-muted-foreground"> · {j.status}</span>
                  {j.attempts > 0 ? <span className="text-muted-foreground"> · tries {j.attempts}</span> : null}
                </p>
                {j.lastError ? (
                  <p className="mt-1 text-xs text-destructive break-all">{j.lastError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
