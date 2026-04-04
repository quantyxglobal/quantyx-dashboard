import { Loader2 } from 'lucide-react'

export default function AdminCaseDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        
        {/* Case header skeleton */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="flex items-center gap-4">
              <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-40 animate-pulse rounded bg-muted" />
              <div className="h-10 w-40 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
        
        {/* Files sections skeleton */}
        <div className="space-y-8">
          {[1, 2].map((section) => (
            <div key={section}>
              <div className="mb-4 h-7 w-32 animate-pulse rounded bg-muted" />
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-64 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-9 w-28 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading case details...</span>
        </div>
      </div>
    </div>
  )
}
