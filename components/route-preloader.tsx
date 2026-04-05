'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function usePrefetch() {
  const router = useRouter()

  const prefetchCaseRoute = (caseId: string) => {
    // Prefetch the case route for better performance
    router.prefetch(`/dashboard/case/${caseId}`)
  }

  const prefetchAdminCaseRoute = (caseId: string) => {
    // Prefetch the admin case route for better performance
    router.prefetch(`/admin/case/${caseId}`)
  }

  const prefetchSuperAdminCaseRoute = (caseId: string) => {
    // Prefetch the superadmin case route for better performance
    router.prefetch(`/superadmin/case/${caseId}`)
  }

  return {
    prefetchCaseRoute,
    prefetchAdminCaseRoute,
    prefetchSuperAdminCaseRoute
  }
}

interface RoutePreloaderProps {
  userRole: 'admin' | 'client'
}

export function RoutePreloader({ userRole }: RoutePreloaderProps) {
  const router = useRouter()

  useEffect(() => {
    // Prefetch common routes based on user role
    if (userRole === 'SUPER_ADMIN') {
      router.prefetch('/superadmin/users')
      router.prefetch('/superadmin/firms')
    } else if (userRole === 'ADMIN') {
      router.prefetch('/admin/users')
      router.prefetch('/admin/firms')
    } else if (userRole === 'EMPLOYEE') {
      router.prefetch('/admin')
    } else {
      router.prefetch('/dashboard/case/create')
      router.prefetch('/dashboard/settings')
    }
  }, [router, userRole])

  return null // This component doesn't render anything
}