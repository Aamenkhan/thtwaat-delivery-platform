'use client'

import { logoutRequest } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useRouter } from 'next/navigation'

export default function WorkerHome() {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Field app</h1>
      <p className="text-sm text-muted-foreground">
        Use <strong>My routes</strong> for assigned orders, then <strong>Scan QR</strong> or{' '}
        <strong>OTP</strong> per workflow. GPS ping logs location to the audit trail.
      </p>
      <Button
        variant="outline"
        type="button"
        onClick={async () => {
          await logoutRequest()
          router.replace('/login')
          router.refresh()
        }}
      >
        Log out
      </Button>
    </div>
  )
}
