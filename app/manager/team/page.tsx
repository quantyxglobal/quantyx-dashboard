import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ManagerTeamClient from '@/components/manager/manager-team-client'

export default async function ManagerTeamPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">My Team</h1>
        <p className="text-muted-foreground mt-2">
          View and manage your team members and their assigned cases
        </p>
      </div>

      <Suspense fallback={<TeamLoadingSkeleton />}>
        <ManagerTeamClient />
      </Suspense>
    </div>
  )
}

function TeamLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted animate-pulse rounded-lg" />
    </div>
  )
}
