import type { ReactNode } from 'react'

import { AdminAuthGate } from '../../components/admin-gate'
import { AdminShell } from '../../components/admin-shell'

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGate>
  )
}
