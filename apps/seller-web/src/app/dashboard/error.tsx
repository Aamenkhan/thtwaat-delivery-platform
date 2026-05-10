'use client'

import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center p-6">
      <Card variant="elevated" className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            This section failed to render. You can retry or go back to the overview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground break-words">
            {error.message || 'Unknown error'}
            {error.digest ? ` · ${error.digest}` : ''}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" type="button" asChild>
            <a href="/dashboard">Overview</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
