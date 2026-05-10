'use client'

import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { Dialog, DialogContent } from './dialog'

export type CommandItem = {
  id: string
  label: string
  onSelect: () => void
  group?: string
}

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: CommandItem[]
  placeholder?: string
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Jump to page or action…',
}: CommandPaletteProps) {
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-lg overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <Command className="rounded-xl bg-card" label="Command menu">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder={placeholder}
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            {items.map((item) => (
              <Command.Item
                key={item.id}
                value={`${item.label} ${item.id} ${item.group ?? ''}`}
                onSelect={() => {
                  item.onSelect()
                  onOpenChange(false)
                }}
                className="flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                {item.label}
              </Command.Item>
            ))}
          </Command.List>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">⌘K · Esc to close</div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function useCommandPaletteToggle() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  return { open, setOpen }
}
