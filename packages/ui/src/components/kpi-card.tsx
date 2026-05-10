import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { Card, CardContent } from './card'

export type KpiCardProps = {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  trend?: { label: string; positive?: boolean }
  className?: string
  variant?: 'default' | 'glass'
}

export function KpiCard({ label, value, hint, icon: Icon, trend, className, variant = 'default' }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(className)}
    >
      <Card variant={variant === 'glass' ? 'glass' : 'elevated'} className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
              {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
              {trend ? (
                <p
                  className={cn(
                    'text-xs font-medium',
                    trend.positive === true && 'text-emerald-600 dark:text-emerald-400',
                    trend.positive === false && 'text-amber-600 dark:text-amber-400',
                    trend.positive === undefined && 'text-muted-foreground'
                  )}
                >
                  {trend.label}
                </p>
              ) : null}
            </div>
            {Icon ? (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Icon className="size-5" aria-hidden />
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
