'use client'

import { Check, Circle } from 'lucide-react'

export type VerticalTimelineStep = {
  event: string
  label: string
  completedAt: string | null
  detail?: string | null
  isCurrent: boolean
  isPending: boolean
}

function formatWhen(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function ShipmentVerticalTimeline({ steps }: { steps: VerticalTimelineStep[] }) {
  return (
    <ol className="relative ms-2 border-s border-border ps-6">
      {steps.map((s, idx) => {
        const when = formatWhen(s.completedAt)
        const done = Boolean(s.completedAt) && !s.isCurrent
        return (
          <li key={s.event + idx} className="mb-8 last:mb-0">
            <span className="absolute -start-[9px] mt-1.5 flex size-4 items-center justify-center">
              {done ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-4 ring-background">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              ) : s.isCurrent ? (
                <span className="relative flex size-4">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-40" />
                  <span className="relative inline-flex size-4 rounded-full bg-blue-600 ring-4 ring-background" />
                </span>
              ) : (
                <span className="flex size-4 items-center justify-center rounded-full border border-muted-foreground/40 bg-muted ring-4 ring-background">
                  <Circle className="size-2 text-muted-foreground" />
                </span>
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <p
                className={
                  done
                    ? 'text-sm font-semibold text-foreground'
                    : s.isCurrent
                      ? 'text-sm font-medium text-foreground'
                      : 'text-sm text-muted-foreground'
                }
              >
                {s.label}
                {done ? ' ✓' : null}
              </p>
              {when ? (
                <p className="text-xs text-muted-foreground">{when}</p>
              ) : null}
              {s.detail ? (
                <p className="text-xs text-muted-foreground/90">{s.detail}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
