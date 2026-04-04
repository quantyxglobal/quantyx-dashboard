'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-destructive/20 bg-card p-8 shadow-card text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          
          <h1 className="mb-2 text-2xl font-semibold text-destructive">
            Dashboard Error
          </h1>
          
          <p className="mb-6 text-muted-foreground">
            We encountered an error loading your dashboard. This might be a temporary issue.
          </p>
          
          {error.digest && (
            <p className="mb-6 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={reset}
              variant="professional"
              className="w-full sm:w-auto"
            >
              Try again
            </Button>
            
            <Button
              onClick={() => window.location.href = '/dashboard'}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
          
          <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              If this problem continues, please contact support with the error ID above.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
