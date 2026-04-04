'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home, Shield } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Admin dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        <div className="mb-4 flex items-center justify-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">
            Admin Dashboard Error
          </h1>
        </div>
        
        <p className="mb-6 text-muted-foreground">
          An error occurred while loading the admin dashboard. Please try again or check system logs.
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
            onClick={() => window.location.href = '/admin'}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to admin
          </Button>
        </div>
        
        <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-foreground mb-2">
            Administrator Note
          </p>
          <p className="text-sm text-muted-foreground">
            Check server logs for detailed error information. If the issue persists, verify database connectivity and permissions.
          </p>
        </div>
      </div>
    </div>
  )
}
