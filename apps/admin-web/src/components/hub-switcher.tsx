'use client'

import { apiFetch } from '@repo/web-core/api'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui'
import { Building2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

type HubRow = {
  id: string
  name: string
  city: string | null
  code: string | null
  hubProfile: { isActive: boolean } | null
}

export function HubSwitcher() {
  const pathname = usePathname()
  const q = useQuery({
    queryKey: ['admin', 'hubs'],
    queryFn: () => apiFetch<{ data: { hubs: HubRow[] } }>('/v1/hubs'),
  })
  const hubs = q.data?.data.hubs ?? []
  const currentId = pathname?.startsWith('/dashboard/hubs/')
    ? pathname.split('/')[3] ?? null
    : null
  const current = hubs.find((h) => h.id === currentId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden max-w-[14rem] gap-1.5 truncate md:inline-flex">
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">{current?.name ?? 'Hubs'}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
        <DropdownMenuLabel>Jump to hub</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hubs.length === 0 ? (
          <DropdownMenuItem disabled>No hubs</DropdownMenuItem>
        ) : (
          hubs.map((h) => {
            const active = h.hubProfile?.isActive !== false
            const dot =
              h.hubProfile == null ? 'bg-amber-500' : active ? 'bg-emerald-500' : 'bg-red-500'
            return (
              <DropdownMenuItem key={h.id} asChild>
                <Link href={`/dashboard/hubs/${h.id}`} className="flex items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${dot}`} title="Hub profile status" />
                  <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{h.code ?? ''}</span>
                </Link>
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/hubs">All hubs list</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
