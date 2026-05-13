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
            ? 'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors'
            : 'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
          compact && active && 'text-primary',
          compact && !active && 'text-muted-foreground hover:text-foreground',
          !compact && active && 'bg-primary/10 text-primary',
          !compact && !active && 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          className
        )}
      >
        {/* Active left bar */}
        {!compact && (
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient transition-all duration-200',
              active ? 'opacity-100' : 'opacity-0'
            )}
          />
        )}
        <span
          className={cn(
            compact ? '' : 'flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
            !compact && active && 'bg-brand-gradient text-white shadow-md',
            !compact && !active && 'bg-muted/50 group-hover:bg-muted'
          )}
        >
          <Icon className={compact ? 'size-5' : 'size-4'} aria-hidden />
        </span>
        {compact ? (
          <span className="max-w-[4.5rem] truncate">{item.label}</span>
        ) : (
          <span className="truncate">{item.label}</span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {/* ── Desktop sidebar ── */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card/50 backdrop-blur-2xl lg:flex">
          {/* Brand */}
          <div className="flex h-16 items-center gap-3 px-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-md">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
            <Link href={brand.href} className="text-sm font-bold tracking-tight hover:text-primary transition-colors">
              {brand.name}
            </Link>
          </div>
          <Separator className="opacity-60" />

          {/* Nav */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/50 p-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
            <Link href={brand.href} className="flex items-center gap-2 text-sm font-bold">
              <span className="flex size-7 items-center justify-center rounded-lg bg-brand-gradient shadow">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              {brand.name}
            </Link>
            <div className="flex items-center gap-2">
              {headerRight}
              <ThemeToggle />
            </div>
          </header>

          {/* Desktop header */}
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-3 border-b border-border/50 bg-background/75 px-6 backdrop-blur-xl lg:flex">
            {headerRight}
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden"
        aria-label="Mobile"
      >
        {bottom.slice(0, 5).map((item) => (
          <NavLink key={item.href} item={item} compact />
        ))}
      </nav>
    </div>
  )
}
