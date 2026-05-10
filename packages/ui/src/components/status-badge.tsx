import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cn } from '../lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      tone: {
        default: 'border-border bg-muted/50 text-foreground',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
        warning: 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
        info: 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100',
        danger: 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100',
        neutral: 'border-transparent bg-secondary text-secondary-foreground',
      },
    },
    defaultVariants: { tone: 'default' },
  }
)

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    icon?: LucideIcon
  }

export function StatusBadge({ className, tone, icon: Icon, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {children}
    </span>
  )
}

/** Map common order lifecycle strings to badge tones */
export function orderStatusTone(status: string): VariantProps<typeof statusBadgeVariants>['tone'] {
  const s = status.toUpperCase()
  if (s.includes('DELIVERED')) return 'success'
  if (s.includes('CANCEL')) return 'danger'
  if (s.includes('RETURN')) return 'warning'
  if (s.includes('OUT_FOR') || s.includes('DELIVERY')) return 'warning'
  if (s.includes('TRANSIT') || s.includes('HUB')) return 'info'
  if (s.includes('PICKED') || s.includes('PICKUP')) return 'info'
  return 'neutral'
}
