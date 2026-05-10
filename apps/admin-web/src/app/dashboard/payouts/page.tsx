'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export default function PayoutsPage() {
  const qc = useQueryClient()
  const summary = useQuery({
    queryKey: ['admin', 'ops-summary'],
    queryFn: () =>
      apiFetch<{ data: { summary: unknown } }>('/v1/admin/ops/summary'),
  })

  const settlement = useMutation({
    mutationFn: () =>
      apiFetch<{ data: unknown }>('/v1/admin/ops/settlement/workers', {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'ops-summary'] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Payouts & settlement</h1>
      <p className="text-sm text-muted-foreground">
        Runs worker settlement batch via{' '}
        <code className="rounded bg-muted px-1">POST /v1/admin/ops/settlement/workers</code>.
      </p>
      <Button
        type="button"
        disabled={settlement.isPending}
        onClick={() => settlement.mutate()}
      >
        {settlement.isPending ? 'Running…' : 'Run worker settlement'}
      </Button>
      {settlement.data ? (
        <pre className="rounded-lg border bg-muted/40 p-3 text-xs">
          {JSON.stringify(settlement.data.data, null, 2)}
        </pre>
      ) : null}
      <h2 className="text-lg font-semibold">Ops summary</h2>
      <pre className="rounded-lg border bg-card p-4 text-xs">
        {JSON.stringify(summary.data?.data.summary ?? null, null, 2)}
      </pre>
    </div>
  )
}
