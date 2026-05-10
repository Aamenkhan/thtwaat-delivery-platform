'use client'

import { cn } from '@repo/ui'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Package,
  Search,
  Truck,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'

// ─── Section Header ──────────────────────────────────────────────────────────

export function SectionHeader({
  label,
  title,
  description,
  actions,
  className,
}: {
  label?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1.5">
        {label && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse-dot" />
            {label}
          </span>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  OUT_FOR_DELIVERY: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  IN_TRANSIT: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20',
  PICKED_UP: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20',
  PICKUP_ASSIGNED: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
  CREATED: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 ring-zinc-500/20',
  CANCELLED: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  INACTIVE: 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20',
  SORT_CENTER: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20',
  DELIVERY_HUB: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20',
  COLLECTION_HUB: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-teal-500/20',
}

const STATUS_DOTS: Record<string, string> = {
  DELIVERED: 'bg-emerald-500',
  OUT_FOR_DELIVERY: 'bg-blue-500',
  IN_TRANSIT: 'bg-indigo-500',
  ACTIVE: 'bg-emerald-500',
  INACTIVE: 'bg-zinc-400',
}

export function StatusPill({ status, pulse }: { status: string; pulse?: boolean }) {
  const key = status.toUpperCase().replace(/ /g, '_')
  const style = STATUS_STYLES[key] ?? 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20'
  const dotColor = STATUS_DOTS[key]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1', style)}>
      {dotColor && (
        <span className={cn('size-1.5 rounded-full', dotColor, pulse && 'animate-pulse-dot')} />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Data Table ───────────────────────────────────────────────────────────────

export type ColDef<T> = {
  key: string
  header: string
  className?: string
  render: (row: T) => ReactNode
}

export function DataTable<T extends { id?: string; publicId?: string }>({
  columns,
  data,
  minWidth,
  emptyMessage,
  isLoading,
  skeletonRows,
}: {
  columns: ColDef<T>[]
  data: T[]
  minWidth?: string
  emptyMessage?: string
  isLoading?: boolean
  skeletonRows?: number
}) {
  if (isLoading) {
    return <SkeletonRows rows={skeletonRows ?? 6} cols={columns.length} />
  }
  if (!data.length) {
    return (
      <EmptyStateBox
        icon={<Package className="size-8 text-muted-foreground/40" />}
        title="No data found"
        description={emptyMessage ?? 'Try adjusting your filters.'}
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', minWidth ?? 'min-w-[600px]')}>
        <thead>
          <tr className="border-b border-border/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'pb-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground last:pr-0',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {data.map((row, idx) => (
            <tr
              key={row.publicId ?? row.id ?? idx}
              className="group transition-colors duration-100 hover:bg-muted/30"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('py-3 pr-4 align-middle last:pr-0', col.className)}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="shimmer h-9 rounded-lg"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

export function FilterBar({
  children,
  onClear,
}: {
  children: ReactNode
  onClear?: () => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
      <Search className="mb-1 size-4 shrink-0 text-muted-foreground" />
      {children}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        className="h-8 min-w-[160px] rounded-lg border border-border bg-background px-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// ─── Empty State Box ──────────────────────────────────────────────────────────

export function EmptyStateBox({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
      {icon && <div className="rounded-2xl bg-muted/50 p-4">{icon}</div>}
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────

export function MapPlaceholder({
  height = 360,
  label = 'Live Map',
}: {
  height?: number
  label?: string
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/30"
      style={{ height }}
    >
      {/* Grid lines */}
      <svg className="absolute inset-0 size-full opacity-10" aria-hidden>
        <defs>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-grid)" />
      </svg>

      {/* Blobs */}
      <div className="absolute left-1/4 top-1/3 size-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute right-1/4 top-1/2 size-24 rounded-full bg-emerald-500/15 blur-2xl" />

      {/* Dots */}
      {[
        { x: '30%', y: '40%', color: 'bg-primary' },
        { x: '55%', y: '30%', color: 'bg-emerald-500' },
        { x: '70%', y: '55%', color: 'bg-amber-500' },
        { x: '20%', y: '65%', color: 'bg-indigo-500' },
        { x: '80%', y: '35%', color: 'bg-violet-500' },
      ].map((dot, i) => (
        <span
          key={i}
          className={cn('absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-white/20', dot.color)}
          style={{ left: dot.x, top: dot.y }}
        >
          <span className={cn('size-1.5 rounded-full bg-white opacity-80')} />
        </span>
      ))}

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-card/80 shadow-premium backdrop-blur-md">
          <MapPin className="size-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Map integration available in production</p>
        </div>
      </div>

      {/* Live badge */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
        LIVE
      </div>
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string
  title: string
  subtitle?: string
  time: string
  type?: 'success' | 'warning' | 'error' | 'info' | 'default'
}

const ACTIVITY_ICONS = {
  success: <CheckCircle2 className="size-4 text-emerald-500" />,
  warning: <AlertCircle className="size-4 text-amber-500" />,
  error: <XCircle className="size-4 text-red-500" />,
  info: <Zap className="size-4 text-blue-500" />,
  default: <Circle className="size-4 text-muted-foreground/50" />,
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <EmptyStateBox
        icon={<Clock className="size-8 text-muted-foreground/40" />}
        title="No recent activity"
        description="Events will appear here in real-time."
      />
    )
  }
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={item.id} className="relative flex gap-3 py-3">
          {/* Connector line */}
          {i < items.length - 1 && (
            <span className="absolute left-[15px] top-[30px] h-[calc(100%-12px)] w-px bg-border/60" />
          )}
          <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
            {ACTIVITY_ICONS[item.type ?? 'default']}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium leading-tight">{item.title}</p>
            {item.subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
            )}
          </div>
          <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">{item.time}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Banner ─────────────────────────────────────────────────────────────

export function StatBanner({
  items,
}: {
  items: { label: string; value: ReactNode; sub?: string; color?: string }[]
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/30 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1 bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {item.label}
          </p>
          <p className={cn('text-2xl font-bold tabular-nums tracking-tight', item.color)}>{item.value}</p>
          {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Live Pulse Indicator ─────────────────────────────────────────────────────

export function LivePill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary">
      <span className="size-2 rounded-full bg-primary animate-pulse-dot" />
      {text}
    </div>
  )
}

// ─── Hub Type Icon ────────────────────────────────────────────────────────────

export function HubTypeBadge({ type }: { type: string }) {
  const key = type.toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        STATUS_STYLES[key] ?? 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20'
      )}
    >
      {key === 'SORT_CENTER' && <Zap className="size-2.5" />}
      {key === 'DELIVERY_HUB' && <Truck className="size-2.5" />}
      {key === 'COLLECTION_HUB' && <Package className="size-2.5" />}
      {type.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Avatar Initials ──────────────────────────────────────────────────────────

export function AvatarInitials({
  name,
  size = 'md',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sizeClass = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-11 text-sm' }[size]

  // Deterministic color from name
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', sizeClass)}
      style={{ background: `hsl(${hue} 55% 50%)` }}
    >
      {initials || '?'}
    </span>
  )
}
