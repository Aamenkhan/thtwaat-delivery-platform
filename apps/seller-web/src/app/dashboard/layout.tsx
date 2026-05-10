import type { ReactNode } from 'react'

import { SellerAuthGate, SellerNav } from '../../components/auth-gate'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SellerAuthGate>
      <SellerNav />
      <div className="mx-auto max-w-5xl p-6">{children}</div>
    </SellerAuthGate>
  )
}
