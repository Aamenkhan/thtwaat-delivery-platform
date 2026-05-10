import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { StatusBadge, orderStatusTone } from './status-badge'

export type TrackingTimelineItem = {
  id: string
  title: string
  subtitle?: string
  timestamp: string
  /** Raw status string for chip coloring */
  statusKey?: string
  meta?: ReactNode
}

export type TrackingTimelineProps = {
  items: TrackingTimelineItem[]
  className?: string
}

export function TrackingTimeline({ items, className }: TrackingTimelineProps) {
  if (items.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground', className)}>
        No journey events yet.
      </div>
    )
  }
  return (
    <ol className={cn('relative space-y-0', className)}>
      <span className="absolute left-[15px] top-3 bottom-3 w-px bg-border" aria-hidden />
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.04 }}
          className="relative flex gap-4 pb-10 last:pb-0"
        >
          <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border bg-card/90 p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium leading-snug">{item.title}</p>
                {item.subtitle ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
              {item.statusKey ? (
                <StatusBadge tone={orderStatusTone(item.statusKey)}>{item.statusKey.replace(/_/g, ' ')}</StatusBadge>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">{item.timestamp}</p>
            {item.meta ? <div className="mt-3 text-xs">{item.meta}</div> : null}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
