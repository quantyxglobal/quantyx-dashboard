import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ManagerCasesClient from '@/components/manager/manager-cases-client'

export default async function ManagerCasesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const userRole = (session.user as any).role

  // Only MANAGER can access this page
  if (userRole !== 'MANAGER') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Cases</h1>
        <p className="text-muted-foreground mt-2">
          View and manage cases assigned to you and your team
        </p>
      </div>

      <Suspense fallback={<CasesLoadingSkeleton />}>
        <ManagerCasesClient />
      </Suspense>
    </div>
  )
}

function CasesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 w-24 bg-muted animate-pulse rounded" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}
