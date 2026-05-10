import type { ReactNode } from 'react'

import { AdminAuthGate, AdminNav } from '../../components/admin-gate'

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </AdminAuthGate>
  )
}
