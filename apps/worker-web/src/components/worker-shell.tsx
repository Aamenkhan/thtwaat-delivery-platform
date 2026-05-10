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
import { readUser } from '@repo/web-core/auth-storage'
import { Camera, LayoutDashboard, LogOut, MapPin, Navigation, QrCode, User, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

const nav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
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
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
  }

  const headerRight = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="subtle" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="hidden max-w-[9rem] truncate sm:inline">{email || 'Worker'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
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
