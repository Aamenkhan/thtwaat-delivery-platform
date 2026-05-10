import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './button'

export type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center',
        className
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border">
          <Icon className="size-7 text-muted-foreground" aria-hidden />
        </span>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <Button className="mt-6" type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
