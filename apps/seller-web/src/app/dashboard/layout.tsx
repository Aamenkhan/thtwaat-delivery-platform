import type { ReactNode } from 'react'

import { SellerAuthGate } from '../../components/auth-gate'
import { SellerShell } from '../../components/seller-shell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SellerAuthGate>
      <SellerShell>{children}</SellerShell>
    </SellerAuthGate>
  )
}
