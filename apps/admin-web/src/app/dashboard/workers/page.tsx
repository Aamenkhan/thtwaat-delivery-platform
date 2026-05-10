'use client'

import { apiFetch } from '@repo/web-core/api'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import { formatDate } from '../../../lib/format'
import {
  AvatarInitials,
  DataTable,
  EmptyStateBox,
  SectionHeader,
  StatBanner,
  StatusPill,
  type ColDef,
} from '../../../components/ui-kit'
import { Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

type Worker = {
  id: string
  displayName: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function WorkersPage() {
  const q = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn: () => apiFetch<{ data: { workers: Worker[] } }>('/v1/workers'),
  })

  const workers = q.data?.data.workers ?? []

  const stats = useMemo(() => {
    const active = workers.filter((w) => w.isActive).length
    const roles = [...new Set(workers.map((w) => w.role))].length
    const byRole = workers.reduce<Record<string, number>>((acc, w) => {
      acc[w.role] = (acc[w.role] ?? 0) + 1
      return acc
    }, {})
    const topRole = Object.entries(byRole).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    return { active, inactive: workers.length - active, roles, topRole }
  }, [workers])

  const columns: ColDef<Worker>[] = [
    {
      key: 'name',
      header: 'Worker',
      render: (w) => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={w.displayName} size="sm" />
          <div>
            <p className="font-medium leading-tight">{w.displayName}</p>
            <p className="text-xs text-muted-foreground">{w.phone ?? 'No phone'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (w) => (
        <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
          {w.role.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (w) => <span className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <StatusPill status={w.isActive ? 'ACTIVE' : 'INACTIVE'} pulse={w.isActive} />,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        label="Workforce"
        title="Workers"
        description="Field delivery agents and hub workforce directory"
      />

      {/* ── Stats ── */}
      <StatBanner
        items={[
          { label: 'Total workers', value: workers.length, sub: 'All roles combined' },
          { label: 'Active', value: stats.active, sub: 'Currently active', color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Inactive', value: stats.inactive, sub: 'Suspended / onboarding', color: 'text-red-500' },
          { label: 'Role types', value: stats.roles, sub: `Most common: ${stats.topRole.replace(/_/g, ' ')}` },
        ]}
      />

      {/* ── Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Worker Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <EmptyStateBox
              icon={<Users className="size-8 text-red-400/50" />}
              title="Failed to load workers"
              description="Check API connectivity and retry."
            />
          ) : (
            <DataTable
              columns={columns}
              data={workers}
              minWidth="min-w-[560px]"
              isLoading={q.isLoading}
              emptyMessage="No workers found in the directory."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
