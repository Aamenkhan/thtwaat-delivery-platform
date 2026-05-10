import { Search } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'

export type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement>

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = 'Search…', ...props }, ref) => (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        {...props}
      />
    </div>
  )
)
SearchInput.displayName = 'SearchInput'
