import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Suspense } from 'react'
import ManagerCaseDetailClient from '@/components/manager/manager-case-detail-client'

export default async function ManagerCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const userRole = (session.user as any).role

  // Only MANAGER can access this page
  if (userRole !== 'MANAGER') {
    redirect('/dashboard')
  }

  const { id } = await params

  return (
    <Suspense fallback={<CaseDetailLoadingSkeleton />}>
      <ManagerCaseDetailClient caseId={id} />
    </Suspense>
  )
}

function CaseDetailLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  )
}
