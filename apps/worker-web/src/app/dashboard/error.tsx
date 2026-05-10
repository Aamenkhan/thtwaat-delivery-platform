'use client'

import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export default function WorkerDashboardError({
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
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col justify-center px-2 py-8">
      <Card variant="elevated" className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <CardTitle>Screen error</CardTitle>
          </div>
          <CardDescription>Field UI failed. You can retry safely.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground break-words">
            {error.message || 'Unknown error'}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" type="button" asChild>
            <a href="/dashboard">Home</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
