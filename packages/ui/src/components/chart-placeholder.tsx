import { cn } from '../lib/utils'

export type ChartPlaceholderProps = {
  title?: string
  className?: string
  /** Normalized heights 0–1 */
  bars?: number[]
}

export function ChartPlaceholder({
  title = 'Volume trend',
  className,
  bars = [0.35, 0.55, 0.42, 0.7, 0.5, 0.62, 0.8, 0.58, 0.45, 0.68, 0.52, 0.75],
}: ChartPlaceholderProps) {
  return (
    <div className={cn('rounded-2xl border bg-card/80 p-5 shadow-sm', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-4 flex h-36 items-end justify-between gap-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-gradient-to-t from-primary/25 to-primary/70 transition-all hover:from-primary/40 hover:to-primary"
            style={{ height: `${Math.max(8, h * 100)}%` }}
            title={`Week ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
