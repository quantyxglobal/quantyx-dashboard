import { prisma } from '@/lib/prisma'
import { AuditAction } from '@prisma/client'

export type PasswordChangeAction = 
  | 'self_change_success' 
  | 'self_change_failed'
  | 'admin_reset_success'
  | 'admin_reset_failed'

export type SecurityAuditAction = 
  | 'RLS_POLICY_VIOLATION'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT_DETECTED'
  | 'AUTHENTICATION_FAILURE'
  | 'SESSION_HIJACK_ATTEMPT'

export async function logPasswordChange(
  userId: string,
  action: PasswordChangeAction,
  details?: string,
  adminId?: string
) {
  try {
    // For self-service operations, admin_id should always be null
    const effectiveAdminId = action.startsWith('self_change') ? null : (adminId || null)
    
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        details: details || null,
        admin_id: effectiveAdminId,
        entity_type: 'user',
        timestamp: new Date()
      }
    })
  } catch (error) {
    // Log to console but don't fail the operation
    console.error('Failed to create audit log:', error)
  }
}

export interface AuditLogParams {
  userId?: string
  action: string | AuditAction | SecurityAuditAction
  details?: string
  adminId?: string
  entityType?: string
  entityId?: string
  organizationId?: string
  ipAddress?: string
  userAgent?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
}

export async function logAuditAction({
  userId,
  action,
  details,
  adminId,
  entityType = 'user',
  entityId,
  organizationId,
  ipAddress,
  userAgent,
  oldValues,
  newValues
}: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId || null,
        action: typeof action === 'string' ? action : action.toString(),
        details: details || null,
        admin_id: adminId || null,
        entity_type: entityType,
        entity_id: entityId || null,
        organization_id: organizationId || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        created_at: new Date()
      }
    })
  } catch (error) {
    // Log to console but don't fail the operation
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Log RLS policy violations and unauthorized access attempts
 * Validates: Requirements 7.5
 */
export async function logSecurityViolation({
  userId,
  action,
  details,
  entityType,
  entityId,
  organizationId,
  ipAddress,
  userAgent,
  attemptedOperation
}: {
  userId?: string
  action: SecurityAuditAction
  details: string
  entityType: string
  entityId?: string
  organizationId?: string
  ipAddress?: string
  userAgent?: string
  attemptedOperation?: string
}) {
  try {
    const securityDetails = {
      violation_type: action,
      attempted_operation: attemptedOperation,
      security_context: details,
      timestamp: new Date().toISOString()
    }

    await logAuditAction({
      userId,
      action,
      details: JSON.stringify(securityDetails),
      entityType,
      entityId,
      organizationId,
      ipAddress,
      userAgent
    })

    // Also log to console for immediate monitoring
    console.warn(`[SECURITY_VIOLATION] ${action}: ${details}`, {
      userId,
      entityType,
      entityId,
      organizationId,
      ipAddress,
      userAgent
    })
  } catch (error) {
    console.error('Failed to log security violation:', error)
  }
}

/**
 * Log database access attempts with user context
 * Validates: Requirements 7.5
 */
export async function logDatabaseAccess({
  userId,
  operation,
  tableName,
  recordId,
  organizationId,
  success,
  errorMessage,
  ipAddress,
  userAgent
}: {
  userId?: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId?: string
  organizationId?: string
  success: boolean
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
}) {
  try {
    const accessDetails = {
      operation,
      table_name: tableName,
      record_id: recordId,
      success,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    }

    await logAuditAction({
      userId,
      action: success ? 'DATABASE_ACCESS_SUCCESS' : 'DATABASE_ACCESS_FAILURE',
      details: JSON.stringify(accessDetails),
      entityType: 'database',
      entityId: recordId,
      organizationId,
      ipAddress,
      userAgent
    })
  } catch (error) {
    console.error('Failed to log database access:', error)
  }
}

/**
 * Log user authentication events
 * Validates: Requirements 7.5
 */
export async function logAuthenticationEvent({
  userId,
  email,
  action,
  success,
  failureReason,
  ipAddress,
  userAgent,
  organizationId
}: {
  userId?: string
  email: string
  action: 'LOGIN' | 'LOGOUT' | 'PASSWORD_RESET' | 'ACCOUNT_LOCKED'
  success: boolean
  failureReason?: string
  ipAddress?: string
  userAgent?: string
  organizationId?: string
}) {
  try {
    const authDetails = {
      email,
      success,
      failure_reason: failureReason,
      timestamp: new Date().toISOString()
    }

    await logAuditAction({
      userId,
      action: success ? `${action}_SUCCESS` : `${action}_FAILURE`,
      details: JSON.stringify(authDetails),
      entityType: 'authentication',
      organizationId,
      ipAddress,
      userAgent
    })
  } catch (error) {
    console.error('Failed to log authentication event:', error)
  }
}
