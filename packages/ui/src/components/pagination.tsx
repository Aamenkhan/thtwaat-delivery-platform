import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { cn } from '../lib/utils'

export type PaginationProps = {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav className={cn('flex items-center justify-center gap-2', className)} aria-label="Pagination">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[4rem] text-center text-sm text-muted-foreground tabular-nums">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}
