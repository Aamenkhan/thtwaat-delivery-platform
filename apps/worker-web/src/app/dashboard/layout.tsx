import type { ReactNode } from 'react'

import { WorkerAuthGate, WorkerNav } from '../../components/worker-gate'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkerAuthGate>
      <WorkerNav />
      <div className="mx-auto max-w-lg space-y-6 p-4">{children}</div>
    </WorkerAuthGate>
  )
}
