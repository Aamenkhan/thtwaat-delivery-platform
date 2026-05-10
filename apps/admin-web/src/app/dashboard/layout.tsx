import type { ReactNode } from 'react'

import { AdminAuthGate, AdminNav } from '../../components/admin-gate'

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <AdminNav />
      <div className="mx-auto max-w-6xl p-6">{children}</div>
    </AdminAuthGate>
  )
}
