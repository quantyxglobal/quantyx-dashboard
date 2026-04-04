'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface SessionCheckerProps {
  requireAuth?: boolean
  requireRole?: ('admin' | 'client')[]
  redirectTo?: string
}

/**
 * Client-side session checker
 * Monitors session status and redirects if needed
 */
export function SessionChecker({ 
  requireAuth = true, 
  requireRole,
  redirectTo = '/login' 
}: SessionCheckerProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    // Check authentication
    if (requireAuth && status === 'unauthenticated') {
      console.log('[SESSION_CHECKER] Unauthenticated, redirecting to:', redirectTo)
      router.push(redirectTo)
      return
    }

    // Check role
    if (requireRole && session?.user) {
      const userRole = session.user.role
      if (!requireRole.includes(userRole)) {
        console.log('[SESSION_CHECKER] Insufficient role, redirecting')
        router.push('/dashboard')
        return
      }
    }
  }, [session, status, requireAuth, requireRole, redirectTo, router])

  return null
}
