import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { NextRequest } from 'next/server'
import { logSecurityViolation, logAuthenticationEvent } from '@/lib/audit-log'
import { checkRateLimit } from '@/lib/rate-limiter'

export interface AuthContext {
  user: {
    id: string
    email: string
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'EMPLOYEE'
    organizationId?: string
    firmNumber?: string
    firstName: string
    lastName: string
    isActive: boolean
  }
  organization?: {
    id: string
    name: string
    firmNumber?: string
    isFirm: boolean
  }
}

export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_SESSION' | 'DATABASE_ERROR' | 'RATE_LIMITED'
  message: string
  statusCode: number
}

/**
 * Extract client IP and User Agent from request
 */
function getRequestContext(req?: NextRequest): { ipAddress?: string; userAgent?: string } {
  if (!req) return {}
  
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   req.ip || 
                   'unknown'
  
  const userAgent = req.headers.get('user-agent') || 'unknown'
  
  return { ipAddress, userAgent }
}

/**
 * Enhanced authentication context retrieval with security logging
 * Validates: Requirements 7.2, 7.4, 7.5, 8.2
 */
export async function getAuthContext(req?: NextRequest): Promise<AuthContext | null> {
  const { ipAddress, userAgent } = getRequestContext(req)
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return null
    }

    let user: any = null

    // Use Supabase directly (fast and reliable)
    try {
      console.log('[AUTH_MIDDLEWARE] Querying Supabase for user:', session.user.id)
      user = await SupabaseDB.getUserById(session.user.id)
      console.log('[AUTH_MIDDLEWARE] Supabase query successful')
    } catch (error) {
      console.error('[AUTH_MIDDLEWARE] Supabase query failed:', error)
      return null
    }

    if (!user) {
      // Log suspicious session with invalid user
      await logSecurityViolation({
        userId: session.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: 'Valid session but user not found or inactive',
        entityType: 'authentication',
        ipAddress,
        userAgent,
        attemptedOperation: 'getAuthContext'
      })
      return null
    }

    // Map role to ensure consistency with design document
    const normalizedRole = user.role.toUpperCase() as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'EMPLOYEE'

    return {
      user: {
        id: user.id,
        email: user.email,
        role: normalizedRole,
        organizationId: user.organization?.id,
        firmNumber: user.organization?.firm_number || undefined,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active
      },
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.display_name || user.organization.name,
        firmNumber: user.organization.firm_number || undefined,
        isFirm: user.organization.is_firm || false
      } : undefined
    }
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Error getting auth context:', error)
    
    // Log database error for security monitoring (but don't fail if logging fails)
    try {
      await logSecurityViolation({
        action: 'DATABASE_ACCESS_FAILURE',
        details: `Authentication database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        entityType: 'authentication',
        ipAddress,
        userAgent,
        attemptedOperation: 'getAuthContext'
      })
    } catch (logError) {
      console.error('[AUTH_MIDDLEWARE] Failed to log security violation:', logError)
    }
    
    return null
  }
}

/**
 * Enhanced role-based access control middleware with security logging
 * Validates: Requirements 7.2, 7.4, 7.5, 8.2
 */
export function requireAuth(allowedRoles?: ('SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'EMPLOYEE')[]) {
  return async function(req?: NextRequest): Promise<AuthContext> {
    const { ipAddress, userAgent } = getRequestContext(req)
    const authContext = await getAuthContext(req)
    
    if (!authContext) {
      // Log authentication failure
      await logAuthenticationEvent({
        email: 'unknown',
        action: 'LOGIN',
        success: false,
        failureReason: 'No valid session',
        ipAddress,
        userAgent
      })
      
      const error: AuthError = {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401
      }
      throw error
    }

    // Check rate limiting for authentication operations
    const rateLimitResult = await checkRateLimit('apiRequest', authContext.user.id, {
      userId: authContext.user.id,
      ipAddress,
      userAgent,
      success: true
    })

    if (!rateLimitResult.allowed) {
      const error: AuthError = {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        statusCode: 429
      }
      throw error
    }

    // Check if user role is allowed
    if (allowedRoles && !allowedRoles.includes(authContext.user.role)) {
      // Log privilege escalation attempt
      await logSecurityViolation({
        userId: authContext.user.id,
        action: 'PRIVILEGE_ESCALATION_ATTEMPT',
        details: `User with role ${authContext.user.role} attempted to access resource requiring roles: ${allowedRoles.join(', ')}`,
        entityType: 'authorization',
        ipAddress,
        userAgent,
        attemptedOperation: 'requireAuth'
      })
      
      const error: AuthError = {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        statusCode: 403
      }
      throw error
    }

    // Validate session integrity
    if (!authContext.user.isActive) {
      await logSecurityViolation({
        userId: authContext.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: 'Inactive user attempted to access system',
        entityType: 'authentication',
        ipAddress,
        userAgent,
        attemptedOperation: 'requireAuth'
      })
      
      const error: AuthError = {
        code: 'INVALID_SESSION',
        message: 'User account is inactive',
        statusCode: 401
      }
      throw error
    }

    return authContext
  }
}

/**
 * Firm-specific access control for client users with security logging
 * Ensures clients can only access their firm's data
 */
export async function requireFirmAccess(organizationId: string, req?: NextRequest): Promise<AuthContext> {
  const { ipAddress, userAgent } = getRequestContext(req)
  const authContext = await requireAuth(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CLIENT', 'EMPLOYEE'])(req)
  
  // Super admins, admins, managers, and employees have global access
  if (authContext.user.role === 'SUPER_ADMIN' || authContext.user.role === 'ADMIN' || authContext.user.role === 'MANAGER' || authContext.user.role === 'EMPLOYEE') {
    return authContext
  }

  // Clients must access only their firm's data
  if (authContext.user.role === 'CLIENT') {
    if (!authContext.user.organizationId || authContext.user.organizationId !== organizationId) {
      // Log unauthorized firm access attempt
      await logSecurityViolation({
        userId: authContext.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: `Client attempted to access organization ${organizationId} but belongs to ${authContext.user.organizationId}`,
        entityType: 'organization',
        entityId: organizationId,
        organizationId: authContext.user.organizationId,
        ipAddress,
        userAgent,
        attemptedOperation: 'requireFirmAccess'
      })
      
      const error: AuthError = {
        code: 'FORBIDDEN',
        message: 'Access denied to organization data',
        statusCode: 403
      }
      throw error
    }
  }

  return authContext
}

/**
 * Admin-only access control with security logging
 * Restricts access to super admins, admins, managers, and employees only
 */
export async function requireAdminAccess(req?: NextRequest): Promise<AuthContext> {
  return await requireAuth(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'])(req)
}

/**
 * Super admin-only access control with security logging
 * Restricts access to super admins only
 */
export async function requireSuperAdminAccess(req?: NextRequest): Promise<AuthContext> {
  return await requireAuth(['SUPER_ADMIN'])(req)
}

/**
 * Utility function to check if user has specific role
 */
export function hasRole(authContext: AuthContext, role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'EMPLOYEE'): boolean {
  return authContext.user.role === role
}

/**
 * Utility function to check if user can manage other users
 */
export function canManageUsers(authContext: AuthContext): boolean {
  return authContext.user.role === 'SUPER_ADMIN' || authContext.user.role === 'ADMIN' || authContext.user.role === 'MANAGER'
}

/**
 * Utility function to check if user can create accounts
 */
export function canCreateAccounts(authContext: AuthContext, targetRole: 'ADMIN' | 'MANAGER' | 'CLIENT' | 'EMPLOYEE'): boolean {
  // Super admin can create any account
  if (authContext.user.role === 'SUPER_ADMIN') {
    return true
  }
  
  // Admin can create manager, client, and employee accounts
  if (authContext.user.role === 'ADMIN') {
    return targetRole === 'MANAGER' || targetRole === 'CLIENT' || targetRole === 'EMPLOYEE'
  }
  
  // Managers cannot create accounts
  if (authContext.user.role === 'MANAGER') {
    return false
  }
  
  // Employees cannot create accounts
  if (authContext.user.role === 'EMPLOYEE') {
    return false
  }
  
  // Client can create only client accounts in same firm
  if (authContext.user.role === 'CLIENT') {
    return targetRole === 'CLIENT'
  }
  
  return false
}

/**
 * Utility function to check if user can assign cases
 */
export function canAssignCases(authContext: AuthContext): boolean {
  return authContext.user.role === 'SUPER_ADMIN' || authContext.user.role === 'ADMIN' || authContext.user.role === 'MANAGER'
}

/**
 * Utility function to check if user can change case status to DELIVERED
 */
export function canMarkAsDelivered(authContext: AuthContext): boolean {
  return authContext.user.role === 'SUPER_ADMIN' || authContext.user.role === 'ADMIN'
}

/**
 * Enhanced error handler for authentication middleware with security logging
 */
export function handleAuthError(error: unknown, req?: NextRequest): Response {
  const { ipAddress, userAgent } = getRequestContext(req)
  
  if (error && typeof error === 'object' && 'code' in error) {
    const authError = error as AuthError
    
    // Log security-related errors
    if (authError.code === 'FORBIDDEN' || authError.code === 'UNAUTHORIZED') {
      logSecurityViolation({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: `Authentication error: ${authError.message}`,
        entityType: 'authentication',
        ipAddress,
        userAgent,
        attemptedOperation: 'handleAuthError'
      }).catch(console.error)
    }
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    
    // Add rate limit headers if applicable
    if (authError.code === 'RATE_LIMITED') {
      headers['Retry-After'] = '60'
    }
    
    return new Response(
      JSON.stringify({ 
        error: authError.message,
        code: authError.code 
      }),
      { 
        status: authError.statusCode,
        headers
      }
    )
  }

  // Generic error response
  return new Response(
    JSON.stringify({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }),
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}