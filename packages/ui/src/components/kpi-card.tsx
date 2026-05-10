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
  color?: 'primary' | 'success' | 'warning' | 'destructive'
}

const colorMap = {
  primary: 'bg-brand-gradient text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-white',
  destructive: 'bg-red-500 text-white',
}

const colorBg = {
  primary: 'bg-primary/10 ring-primary/20',
  success: 'bg-emerald-500/10 ring-emerald-500/20',
  warning: 'bg-amber-500/10 ring-amber-500/20',
  destructive: 'bg-red-500/10 ring-red-500/20',
}

export function KpiCard({ label, value, hint, icon: Icon, trend, className, variant = 'default', color = 'primary' }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('card-hover', className)}
    >
      <Card variant={variant === 'glass' ? 'glass' : 'elevated'} className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
              {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
              {trend ? (
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      trend.positive === true && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      trend.positive === false && 'bg-red-500/10 text-red-600 dark:text-red-400',
                      trend.positive === undefined && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {trend.positive === true && '↑ '}
                    {trend.positive === false && '↓ '}
                    {trend.label}
                  </span>
                </div>
              ) : null}
            </div>
            {Icon ? (
              <span className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1',
                colorBg[color]
              )}>
                <span className={cn('flex size-8 items-center justify-center rounded-lg', colorMap[color])}>
                  <Icon className="size-4" aria-hidden />
                </span>
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
