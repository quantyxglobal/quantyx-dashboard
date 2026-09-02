/**
 * Centralized role-based redirect logic
 * Ensures users always land on the correct dashboard based on their role
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CLIENT'

/**
 * Get the default dashboard URL for a user role
 */
export function getDefaultDashboardForRole(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/superadmin'
    case 'ADMIN':
      return '/admin'
    case 'MANAGER':
      return '/manager'
    case 'EMPLOYEE':
      return '/admin' // Employees use admin dashboard with restrictions
    case 'CLIENT':
      return '/dashboard'
    default:
      return '/login'
  }
}

/**
 * Check if a user role can access a specific path
 */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  // Public paths
  if (pathname === '/' || pathname === '/login' || pathname === '/register') {
    return true
  }

  // Super admin can access everything
  if (role === 'SUPER_ADMIN') {
    return true
  }

  // Admin can access admin and their own dashboard
  if (role === 'ADMIN') {
    return pathname.startsWith('/admin') || pathname.startsWith('/dashboard')
  }

  // Manager can only access manager dashboard
  if (role === 'MANAGER') {
    return pathname.startsWith('/manager')
  }

  // Employee can only access admin dashboard
  if (role === 'EMPLOYEE') {
    return pathname.startsWith('/admin')
  }

  // Client can only access client dashboard
  if (role === 'CLIENT') {
    return pathname.startsWith('/dashboard')
  }

  return false
}

/**
 * Get the correct redirect URL for a user trying to access an invalid path
 */
export function getRedirectForInvalidAccess(role: UserRole, attemptedPath: string): string {
  // If they're trying to access a protected area they don't have access to,
  // redirect them to their default dashboard
  return getDefaultDashboardForRole(role)
}

/**
 * Determine if a path is a role-specific protected route
 */
export function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/superadmin')
  )
}

/**
 * Get the appropriate dashboard based on role hierarchy
 * Used after login to redirect to the correct dashboard
 */
export function getLoginRedirect(role: UserRole, callbackUrl?: string): string {
  // If there's a valid callback URL and the user can access it, use it
  if (callbackUrl && callbackUrl !== '/login' && callbackUrl !== '/register') {
    if (canAccessPath(role, callbackUrl)) {
      return callbackUrl
    }
  }

  // Otherwise, redirect to their default dashboard
  return getDefaultDashboardForRole(role)
}
