"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { canAccessPath, getRedirectForInvalidAccess, isProtectedRoute, type UserRole } from '@/lib/role-redirect'

/**
 * Client-side redirect handler for invalid URLs
 * Ensures users are redirected to appropriate pages based on their role
 */
export function RedirectHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()

  useEffect(() => {
    // Skip if still loading
    if (status === 'loading') return

    // Skip if not a protected route
    if (!isProtectedRoute(pathname)) return

    // If not authenticated and trying to access protected route, redirect to login
    if (status === 'unauthenticated') {
      console.log('[REDIRECT_HANDLER] Unauthenticated user, redirecting to login')
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }

    // If authenticated, check if user can access this path
    if (status === 'authenticated' && session?.user) {
      // Map session role to UserRole
      const roleMap: Record<string, UserRole> = {
        'admin': 'ADMIN',
        'employee': 'EMPLOYEE',
        'client': 'CLIENT'
      }
      
      const userRole = roleMap[session.user.role] || 'CLIENT'
      
      // Check if user can access this path
      if (!canAccessPath(userRole, pathname)) {
        console.log('[REDIRECT_HANDLER] User cannot access path, redirecting')
        const redirectUrl = getRedirectForInvalidAccess(userRole, pathname)
        router.push(redirectUrl)
      }
    }
  }, [pathname, session, status, router])

  return null // This component doesn't render anything
}
