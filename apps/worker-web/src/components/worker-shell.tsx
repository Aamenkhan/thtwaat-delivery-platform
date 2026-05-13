'use client'

import {
  AppShell,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui'
import { logoutRequest } from '@repo/web-core/api'
import { clearTokens, readTokens, readUser } from '@repo/web-core/auth-storage'
import { Camera, LayoutDashboard, LogOut, MapPin, Navigation, QrCode, User, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { clearWorkerSession, readWorkerId } from '../lib/worker-session'

const nav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/dashboard/routes', label: 'Routes', icon: MapPin },
  { href: '/dashboard/scan', label: 'Scan', icon: QrCode },
  { href: '/dashboard/otp', label: 'OTP', icon: KeyRound },
  { href: '/dashboard/photo', label: 'Proof', icon: Camera },
  { href: '/dashboard/gps', label: 'GPS', icon: Navigation },
]

const mobileNav = nav.filter((n) => n.href !== '/dashboard/gps')

export function WorkerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [label, setLabel] = useState('')
  useEffect(() => {
    const u = readUser()?.email
    const id = readWorkerId()
    setLabel(u || (id ? `Worker ${id.slice(0, 6)}…` : 'Worker'))
  }, [])

  async function logout() {
    clearWorkerSession()
    try {
      if (readTokens()?.accessToken) await logoutRequest()
    } catch {
      clearTokens()
    }
    router.replace('/login')
    router.refresh()
  }

  const headerRight = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="subtle" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="hidden max-w-[9rem] truncate sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/gps">GPS ping</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <AppShell
      brand={{ name: 'Field', href: '/dashboard' }}
      pathname={pathname}
      Link={Link}
      nav={nav}
      mobileNav={mobileNav}
      headerRight={headerRight}
    >
      {children}
    </AppShell>
  )
}
