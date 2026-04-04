'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorDisplayProps {
  message: string
  onRetry?: () => void
  showRetry?: boolean
}

/**
 * Error Display Component
 * 
 * Displays user-friendly error messages with optional retry button
 * 
 * Validates: Requirement 11.6
 */
export function ErrorDisplay({ message, onRetry, showRetry = true }: ErrorDisplayProps) {
  return (
    <Card className="border-destructive/20 shadow-card">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-destructive">Something went wrong</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Inline Error Display (for smaller contexts)
 */
export function InlineErrorDisplay({ message, onRetry, showRetry = true }: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-destructive/20 rounded-md bg-destructive/10">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive">{message}</p>
      </div>
      {showRetry && onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="gap-2 flex-shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  )
}
