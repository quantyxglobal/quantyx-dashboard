/**
 * Session Management Utilities
 * Handles session validation, refresh, and cookie management
 */

import { auth } from '@/auth'
import { cookies } from 'next/headers'

/**
 * Get the current session with validation
 */
export async function getSession() {
  try {
    const session = await auth()
    return session
  } catch (error) {
    console.error('[SESSION] Failed to get session:', error)
    return null
  }
}

/**
 * Validate session and ensure user is authenticated
 */
export async function requireSession() {
  const session = await getSession()
  
  if (!session || !session.user) {
    throw new Error('Authentication required')
  }
  
  return session
}

/**
 * Validate session and ensure user has required role
 */
export async function requireRole(allowedRoles: ('admin' | 'client')[]) {
  const session = await requireSession()
  
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Insufficient permissions')
  }
  
  return session
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getSession()
  return !!session?.user
}

/**
 * Get session cookie
 */
export async function getSessionCookie() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('next-auth.session-token') || 
                       cookieStore.get('__Secure-next-auth.session-token')
  return sessionToken
}

/**
 * Check if session cookie exists
 */
export async function hasSessionCookie() {
  const cookie = await getSessionCookie()
  return !!cookie
}

/**
 * Session info for debugging
 */
export async function getSessionInfo() {
  const session = await getSession()
  const hasCookie = await hasSessionCookie()
  
  return {
    isAuthenticated: !!session?.user,
    hasCookie,
    userId: session?.user?.id,
    userRole: session?.user?.role,
    userEmail: session?.user?.email,
  }
}
