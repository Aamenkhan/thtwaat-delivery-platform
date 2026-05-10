'use client'

import type { LucideIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Separator } from './separator'
import { ThemeToggle } from './theme-toggle'

export type ShellNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export type AppShellLinkProps = {
  href: string
  className?: string
  children: ReactNode
}

export type AppShellProps = {
  brand: { name: string; href: string }
  nav: ShellNavItem[]
  pathname: string
  /** Next.js `Link` or router-aware anchor */
  Link: ComponentType<AppShellLinkProps>
  headerRight?: ReactNode
  children: ReactNode
  mobileNav?: ShellNavItem[]
}

export function AppShell({
  brand,
  nav,
  pathname,
  Link,
  headerRight,
  children,
  mobileNav,
}: AppShellProps) {
  const bottom = mobileNav ?? nav

  const NavLink = ({
    item,
    className,
    compact,
  }: {
    item: ShellNavItem
    className?: string
    compact?: boolean
  }) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        className={cn(
          compact
            ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium'
            : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          !compact && active && 'bg-primary/10 text-primary',
          !compact && !active && 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          compact && active && 'text-primary',
          compact && !active && 'text-muted-foreground',
          className
        )}
      >
        <Icon className={compact ? 'size-5' : 'size-4 shrink-0'} aria-hidden />
        {compact ? <span className="max-w-[4.5rem] truncate">{item.label}</span> : item.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-card/40 backdrop-blur-xl lg:flex">
          <div className="flex h-14 items-center gap-2 px-4">
            <Link href={brand.href} className="text-sm font-semibold tracking-tight hover:text-primary">
              {brand.name}
            </Link>
          </div>
          <Separator />
          <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="mt-auto border-t p-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2 py-2">
              <span className="text-xs text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md lg:hidden">
            <Link href={brand.href} className="text-sm font-semibold">
              {brand.name}
            </Link>
            <div className="flex items-center gap-2">
              {headerRight}
              <ThemeToggle />
            </div>
          </header>
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-3 border-b border-border/60 bg-background/70 px-6 backdrop-blur-md lg:flex">
            {headerRight}
            <ThemeToggle />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile"
      >
        {bottom.slice(0, 5).map((item) => (
          <NavLink key={item.href} item={item} compact />
        ))}
      </nav>
    </div>
  )
}
