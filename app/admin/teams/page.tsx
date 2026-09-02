import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import TeamsManagementClient from '@/components/admin/teams/teams-management-client'

export default async function TeamsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const userRole = (session.user as any).role

  // Only SUPER_ADMIN and ADMIN can access teams management
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teams Management</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage teams, assign managers, and organize employees
        </p>
      </div>

      <Suspense fallback={<TeamsLoadingSkeleton />}>
        <TeamsManagementClient />
      </Suspense>
    </div>
  )
}

function TeamsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}
