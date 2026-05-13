import type { ReactNode } from 'react'

import { WorkerAuthGate } from '../../../components/worker-gate'
import { WorkerShell } from '../../../components/worker-shell'

export default function OrderLayout({ children }: { children: ReactNode }) {
  return (
    <WorkerAuthGate>
      <WorkerShell>
        <div className="mx-auto w-full max-w-lg space-y-6 pb-4">{children}</div>
      </WorkerShell>
    </WorkerAuthGate>
  )
}
