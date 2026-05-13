'use client'

import {
  AppShell,
  Button,
  CommandPalette,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useCommandPaletteToggle,
  type CommandItem,
} from '@repo/ui'
import { logoutRequest } from '@repo/web-core/api'
import { readUser } from '@repo/web-core/auth-storage'
import {
  BarChart3,
  Building2,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Map,
  Package,
  Radio,
  Shield,
  Store,
  Tags,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { HubSwitcher } from './hub-switcher'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/sellers', label: 'Sellers', icon: Store },
  { href: '/dashboard/shipments', label: 'Shipments', icon: Package },
  { href: '/dashboard/live', label: 'Live map', icon: Radio },
  { href: '/dashboard/hubs', label: 'Hubs', icon: Building2 },
  { href: '/dashboard/zones', label: 'Zones', icon: Map },
  { href: '/dashboard/workers', label: 'Workers', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/cod', label: 'COD', icon: IndianRupee },
  { href: '/dashboard/pricing', label: 'Pricing', icon: Tags },
  { href: '/dashboard/payouts', label: 'Payouts', icon: CreditCard },
  { href: '/dashboard/ops', label: 'Ops', icon: Shield },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { open, setOpen } = useCommandPaletteToggle()
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])

  const commands = useMemo<CommandItem[]>(
    () =>
      nav.map((n) => ({
        id: n.href,
        label: n.label,
        group: 'Navigate',
        onSelect: () => router.push(n.href),
      })),
    [router]
  )

  async function logout() {
    await logoutRequest()
    router.replace('/login')
    router.refresh()
  }

  const headerRight = (
    <div className="flex items-center gap-2">
      <HubSwitcher />
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="subtle" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="hidden max-w-[10rem] truncate sm:inline">{email || 'Admin'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => setOpen(true)}>Command palette ⌘K</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <>
      <CommandPalette open={open} onOpenChange={setOpen} items={commands} />
      <AppShell
        brand={{ name: 'Ops Console', href: '/dashboard' }}
        pathname={pathname}
        Link={Link}
        nav={nav}
        headerRight={headerRight}
        mobileNav={nav.filter((n) =>
          [
            '/dashboard',
            '/dashboard/shipments',
            '/dashboard/hubs',
            '/dashboard/live',
            '/dashboard/analytics',
            '/dashboard/sellers',
          ].includes(n.href)
        )}
      >
        {children}
      </AppShell>
    </>
  )
}
