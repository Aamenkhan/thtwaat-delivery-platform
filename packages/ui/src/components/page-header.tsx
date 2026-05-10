import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  badge?: string
}

export function PageHeader({ title, description, actions, className, badge }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-2">
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
            {badge}
          </span>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
