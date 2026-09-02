import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ManagerDashboardClient from '@/components/manager/manager-dashboard-client'

export default async function ManagerDashboardPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your cases and team performance
        </p>
      </div>

      <Suspense fallback={<DashboardLoadingSkeleton />}>
        <ManagerDashboardClient />
      </Suspense>
    </div>
  )
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map(i => (
          <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}
