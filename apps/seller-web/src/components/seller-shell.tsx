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
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/shipments', label: 'Shipments', icon: Package },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/returns', label: 'Returns', icon: RotateCcw },
  { href: '/dashboard/wallet', label: 'Wallet', icon: CreditCard },
  { href: '/dashboard/plans', label: 'Plans', icon: Sparkles },
]

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { open, setOpen } = useCommandPaletteToggle()
  const [email, setEmail] = useState('')
  useEffect(() => {
    setEmail(readUser()?.email ?? '')
  }, [])

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'home', label: 'Overview', group: 'Navigate', onSelect: () => router.push('/dashboard') },
      { id: 'ship', label: 'Shipments', group: 'Navigate', onSelect: () => router.push('/dashboard/shipments') },
      {
        id: 'new',
        label: 'Create shipment',
        group: 'Navigate',
        onSelect: () => router.push('/dashboard/shipments/new'),
      },
      { id: 'analytics', label: 'Analytics', group: 'Navigate', onSelect: () => router.push('/dashboard/analytics') },
      { id: 'wallet', label: 'Wallet & payouts', group: 'Navigate', onSelect: () => router.push('/dashboard/wallet') },
      { id: 'plans', label: 'Subscription plans', group: 'Navigate', onSelect: () => router.push('/dashboard/plans') },
    ],
    [router]
  )

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
          <span className="hidden max-w-[10rem] truncate sm:inline">{email || 'Account'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => setOpen(true)}>Command palette ⌘K</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <CommandPalette open={open} onOpenChange={setOpen} items={commands} />
      <AppShell
        brand={{ name: 'Thtwaat Seller', href: '/dashboard' }}
        pathname={pathname}
        Link={Link}
        nav={nav}
        headerRight={headerRight}
        mobileNav={nav.filter((n) =>
          ['/dashboard', '/dashboard/shipments', '/dashboard/wallet', '/dashboard/analytics', '/dashboard/plans'].includes(
            n.href
          )
        )}
      >
        {children}
      </AppShell>
    </>
  )
}
